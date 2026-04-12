/**
 * .song — YouTube audio downloader
 * Races multiple APIs in parallel, caches results for 90 minutes
 */

const axios = require('axios');
const yts   = require('yt-search');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
};

// In-memory result cache
const cache    = new Map();
const CACHE_TTL = 90 * 60 * 1000;
const MAX_CACHE = 200;

function cacheKey(q) { return q.toLowerCase().trim(); }

function getCached(q) {
  const entry = cache.get(cacheKey(q));
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(cacheKey(q)); return null; }
  return entry;
}

function setCache(q, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(q), { ...value, ts: Date.now() });
}

// API callers — each with independent timeout
async function trySiputzx(url) {
  const res = await axios.get(
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.data;
  if (res?.data?.status && (d?.download_url || d?.url)) {
    return { download: d.download_url || d.url, title: d.title, thumbnail: d.thumbnail };
  }
  throw new Error('no dl');
}

async function tryVreden(url) {
  const res = await axios.get(
    `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result || res?.data?.data;
  if (d?.download || d?.url || d?.mp3) {
    return { download: d.download || d.url || d.mp3, title: d.title, thumbnail: d.thumbnail };
  }
  throw new Error('no dl');
}

async function tryAgatz(url) {
  const res = await axios.get(
    `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.data;
  if (d?.audio || d?.url || d?.download) {
    return { download: d.audio || d.url || d.download, title: d.title, thumbnail: d.thumbnail };
  }
  throw new Error('no dl');
}

async function tryIzumiUrl(url) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryIzumiQuery(query) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryOkatsu(url) {
  const res = await axios.get(
    `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (res?.data?.dl) return { download: res.data.dl, title: res.data.title, thumbnail: res.data.thumb };
  throw new Error('no dl');
}

async function tryElitePro(url) {
  const res = await axios.get(
    `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (res?.data?.success && res?.data?.downloadURL) {
    return { download: res.data.downloadURL, title: res.data.title, thumbnail: null };
  }
  throw new Error('no dl');
}

async function tryNyxs(url) {
  const res = await axios.get(
    `https://nyxs.pw/dl/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result || res?.data?.data || res?.data;
  const dl = d?.download || d?.url || d?.link || d?.audio;
  if (dl) return { download: dl, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

// Race all URL-based APIs in parallel
async function fetchByUrl(url) {
  return Promise.any([
    trySiputzx(url),
    tryVreden(url),
    tryAgatz(url),
    tryIzumiUrl(url),
    tryOkatsu(url),
    tryElitePro(url),
    tryNyxs(url),
  ]);
}

// For plain text queries: try query-based API + YouTube search simultaneously
async function fetchByQuery(query) {
  const [izumi, ytsRes] = await Promise.allSettled([
    tryIzumiQuery(query),
    yts(query).then(r => r.videos?.[0] || null),
  ]);

  if (izumi.status === 'fulfilled') return izumi.value;

  if (ytsRes.status === 'fulfilled' && ytsRes.value) {
    const v = ytsRes.value;
    const result = await fetchByUrl(v.url);
    result.title     = result.title     || v.title;
    result.thumbnail = result.thumbnail || (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/sddefault.jpg` : null);
    result.duration  = v.duration?.timestamp || '';
    return result;
  }

  throw new Error('all song APIs failed');
}

module.exports = {
  name: 'song',
  aliases: ['music', 'mp3', 'audio'],
  category: 'media',
  description: 'Search YouTube and download as audio/song',
  usage: '.song <song name or YouTube URL>',

  async execute(sock, msg, args, extra) {
    const { reply, react } = extra;
    const chatId = msg.key.remoteJid;

    const query = args.join(' ').trim();
    if (!query) {
      return reply('❌ Please provide a song name or YouTube link.\n\nUsage: `.song <song name>`');
    }

    await react('⏳');

    // Cache hit: send immediately
    const cached = getCached(query);
    if (cached) {
      try {
        await sock.sendMessage(chatId, {
          audio: { url: cached.download },
          mimetype: 'audio/mpeg',
          fileName: `${(cached.title || 'audio').replace(/[^\w\s-]/g, '').trim()}.mp3`,
          ptt: false,
        }, { quoted: msg });
        await react('✅');
        return;
      } catch (_) {
        cache.delete(cacheKey(query));
      }
    }

    // Fetch from APIs
    let result = null;
    const isUrl = YT_REGEX.test(query);

    try {
      result = isUrl ? await fetchByUrl(query) : await fetchByQuery(query);
    } catch (_) {
      if (isUrl) {
        try { result = await fetchByQuery(query); } catch (_2) {}
      }
    }

    if (!result?.download) {
      await react('❌');
      return reply(`❌ Could not find *"${query}"*. Try another name or link.`);
    }

    const title     = result.title    || query;
    const thumb     = result.thumbnail || null;
    const duration  = result.duration  || '';
    const safeTitle = title.replace(/[^\w\s-]/g, '').trim() || 'audio';

    setCache(query, result);

    // Send thumbnail info card first
    if (thumb) {
      try {
        await sock.sendMessage(chatId, {
          image: { url: thumb },
          caption: `🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n\n> 💫 *INFINITY MD*`,
        }, { quoted: msg });
      } catch (_) {}
    }

    // Send audio via URL (fastest)
    try {
      await sock.sendMessage(chatId, {
        audio: { url: result.download },
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`,
        ptt: false,
      }, { quoted: msg });
      await react('✅');
      return;
    } catch (_) {}

    // Buffer fallback (if URL send fails)
    try {
      const buf = Buffer.from(
        (await axios.get(result.download, { responseType: 'arraybuffer', timeout: 60000, headers: HEADERS })).data
      );
      await sock.sendMessage(chatId, {
        audio: buf,
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`,
        ptt: false,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply('❌ Failed to send audio. Please try again.');
    }
  },
};
