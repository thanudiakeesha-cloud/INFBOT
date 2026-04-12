/**
 * .song — YouTube audio downloader
 * Races multiple APIs in parallel to get download URL,
 * streams buffer directly and sends bytes to WhatsApp chat.
 */

const axios  = require('axios');
const yts    = require('yt-search');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'audio/*, */*',
};

// Buffer cache (stores actual MP3 bytes so repeat requests are instant)
const cache    = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE = 60;

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

// Download buffer from a CDN URL
async function streamToBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: HEADERS,
    maxRedirects: 10,
  });
  return Buffer.from(res.data);
}

// API callers — short timeouts since we race all in parallel
async function trySiputzx(url) {
  const res = await axios.get(
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.data;
  if (res?.data?.status && (d?.download_url || d?.url))
    return { download: d.download_url || d.url, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryVreden(url) {
  const res = await axios.get(
    `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.result || res?.data?.data;
  if (d?.download || d?.url || d?.mp3)
    return { download: d.download || d.url || d.mp3, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryAgatz(url) {
  const res = await axios.get(
    `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.data;
  if (d?.audio || d?.url || d?.download)
    return { download: d.audio || d.url || d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryIzumiUrl(url) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryIzumiQuery(query) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryOkatsu(url) {
  const res = await axios.get(
    `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  if (res?.data?.dl) return { download: res.data.dl, title: res.data.title, thumbnail: res.data.thumb };
  throw new Error('no dl');
}

async function tryElitePro(url) {
  const res = await axios.get(
    `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 12000 }
  );
  if (res?.data?.success && res?.data?.downloadURL)
    return { download: res.data.downloadURL, title: res.data.title, thumbnail: null };
  throw new Error('no dl');
}

async function tryNyxs(url) {
  const res = await axios.get(
    `https://nyxs.pw/dl/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.result || res?.data?.data || res?.data;
  const dl = d?.download || d?.url || d?.link || d?.audio;
  if (dl) return { download: dl, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

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

async function fetchByQuery(query) {
  const ytSearchChain = yts(query).then(async r => {
    const v = r.videos?.[0];
    if (!v) throw new Error('no yt results');
    const result = await fetchByUrl(v.url);
    result.title     = result.title     || v.title;
    result.thumbnail = result.thumbnail || (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/sddefault.jpg` : null);
    result.duration  = v.duration?.timestamp || '';
    return result;
  });
  return Promise.any([tryIzumiQuery(query), ytSearchChain]);
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
    if (!query) return reply('❌ Please provide a song name or YouTube link.\n\nUsage: `.song <song name>`');

    await react('⏳');

    // Cache hit — send buffered bytes immediately
    const cached = getCached(query);
    if (cached?.buf) {
      try {
        await sock.sendMessage(chatId, {
          audio: cached.buf,
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

    // Fetch download URL (all APIs race in parallel)
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

    // Send thumbnail card immediately (non-blocking)
    if (thumb) {
      sock.sendMessage(chatId, {
        image: { url: thumb },
        caption: `🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n\n> 💫 *INFINITY MD*`,
      }, { quoted: msg }).catch(() => {});
    }

    // Stream the audio bytes directly into WhatsApp
    let buf;
    try {
      buf = await streamToBuffer(result.download);
    } catch (e) {
      console.error('Song download error:', e.message);
      await react('❌');
      return reply('❌ Failed to download audio. Please try again.');
    }

    try {
      await sock.sendMessage(chatId, {
        audio: buf,
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`,
        ptt: false,
      }, { quoted: msg });
      await react('✅');
      setCache(query, { buf, title, thumbnail: thumb, duration });
    } catch (e) {
      console.error('Song send error:', e.message);
      await react('❌');
      reply('❌ Failed to send audio. Please try again.');
    }
  },
};
