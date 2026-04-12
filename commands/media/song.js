/**
 * .song — YouTube audio downloader
 * Flow:
 *   1. yt-search for song info → send info card + thumbnail immediately
 *   2. Race all download APIs in parallel (12 s timeout each)
 *   3. Stream buffer → send audio bytes directly to WhatsApp chat
 */

const axios = require('axios');
const yts   = require('yt-search');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

/* ─── Buffer cache (stores raw MP3 bytes) ─── */
const cache     = new Map();
const CACHE_TTL = 60 * 60 * 1000;   // 1 hour
const MAX_CACHE = 60;

function cacheKey(q) { return q.toLowerCase().trim(); }
function getCached(q) {
  const e = cache.get(cacheKey(q));
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(cacheKey(q)); return null; }
  return e;
}
function setCache(q, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(q), { ...value, ts: Date.now() });
}

/* ─── Download URL → Buffer ─── */
async function streamToBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: { ...HEADERS, Accept: 'audio/*, */*' },
    maxRedirects: 10,
  });
  return Buffer.from(res.data);
}

/* ─── yt-search helper ─── */
async function ytSearch(query) {
  const r = await yts(query);
  return r.videos?.[0] || null;
}

async function ytSearchByUrl(url) {
  const match = url.match(YT_REGEX);
  if (!match) return null;
  const r = await yts({ videoId: match[1] });
  return r || null;
}

/* ─── ytdl-core direct download (most reliable when it works) ─── */
async function tryYtdlCore(ytUrl) {
  const ytdl = require('ytdl-core');
  const info = await ytdl.getInfo(ytUrl, { requestOptions: { headers: HEADERS } });
  const formats = info.formats.filter(f => f.hasAudio && !f.hasVideo && f.url);
  formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
  if (!formats.length) throw new Error('no audio format');
  return formats[0].url;
}

/* ─── Download audio buffer via ytdl-core stream ─── */
async function streamToBufferYtdl(ytUrl) {
  const ytdl = require('ytdl-core');
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = ytdl(ytUrl, { quality: 'highestaudio', filter: 'audioonly', requestOptions: { headers: HEADERS } });
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    setTimeout(() => reject(new Error('ytdl stream timeout')), 90000);
  });
}

/* ─── Individual download API callers ─── */
async function trySiputzx(url) {
  const r = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 });
  const d = r?.data?.data;
  if (r?.data?.status && (d?.download_url || d?.url))
    return d.download_url || d.url;
  throw new Error('no dl');
}
async function tryVreden(url) {
  const r = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 });
  const d = r?.data?.result || r?.data?.data;
  const dl = d?.download || d?.url || d?.mp3;
  if (dl) return dl;
  throw new Error('no dl');
}
async function tryAgatz(url) {
  const r = await axios.get(`https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 });
  const d = r?.data?.data;
  const dl = d?.audio || d?.url || d?.download;
  if (dl) return dl;
  throw new Error('no dl');
}
async function tryIzumiUrl(url) {
  const r = await axios.get(`https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 12000 });
  const dl = r?.data?.result?.download;
  if (dl) return dl;
  throw new Error('no dl');
}
async function tryIzumiQuery(query) {
  const r = await axios.get(`https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`,
    { headers: HEADERS, timeout: 12000 });
  const dl = r?.data?.result?.download;
  if (dl) return dl;
  throw new Error('no dl');
}
async function tryOkatsu(url) {
  const r = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 });
  if (r?.data?.dl) return r.data.dl;
  throw new Error('no dl');
}
async function tryElitePro(url) {
  const r = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 12000 });
  if (r?.data?.success && r?.data?.downloadURL) return r.data.downloadURL;
  throw new Error('no dl');
}
async function tryNyxs(url) {
  const r = await axios.get(`https://nyxs.pw/dl/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 });
  const d = r?.data?.result || r?.data?.data || r?.data;
  const dl = d?.download || d?.url || d?.link || d?.audio;
  if (dl) return dl;
  throw new Error('no dl');
}

/* ─── Race all APIs by URL ─── */
async function fetchDownloadUrl(ytUrl) {
  return Promise.any([
    tryYtdlCore(ytUrl),
    trySiputzx(ytUrl),
    tryVreden(ytUrl),
    tryAgatz(ytUrl),
    tryIzumiUrl(ytUrl),
    tryOkatsu(ytUrl),
    tryElitePro(ytUrl),
    tryNyxs(ytUrl),
  ]);
}

/* ─── Race all APIs by query (text search) ─── */
async function fetchDownloadUrlByQuery(query) {
  const fromYtSearch = ytSearch(query).then(v => {
    if (!v) throw new Error('no results');
    return fetchDownloadUrl(v.url);
  });
  return Promise.any([tryIzumiQuery(query), fromYtSearch]);
}

/* ════════════════════════════════════════════ */
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
    if (!query) return reply('❌ Please provide a song name or YouTube link.\nUsage: `.song <song name>`');

    await react('⏳');

    /* ── Cache hit: send buffered bytes immediately ── */
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

    /* ── STEP 1: Quick yt-search → send info card instantly ── */
    const isUrl     = YT_REGEX.test(query);
    const ytIdMatch = query.match(YT_REGEX);
    const ytId      = ytIdMatch ? ytIdMatch[1] : null;

    let infoTitle  = query;
    let infoThumb  = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null;
    let infoDur    = '';
    let infoViews  = '';
    let infoArtist = '';

    // Fire yt-search in background (non-blocking for the download race)
    const searchPromise = isUrl
      ? (ytId ? yts({ videoId: ytId }).catch(() => null) : Promise.resolve(null))
      : yts(query).then(r => r?.videos?.[0] || null).catch(() => null);

    // Wait for search first so we can show a proper info card
    const videoInfo = await searchPromise;
    if (videoInfo) {
      infoTitle  = videoInfo.title  || videoInfo.url || query;
      infoThumb  = (videoInfo.videoId
        ? `https://i.ytimg.com/vi/${videoInfo.videoId}/maxresdefault.jpg`
        : infoThumb) || infoThumb;
      infoDur    = videoInfo.duration?.timestamp || '';
      infoViews  = videoInfo.views
        ? Intl.NumberFormat('en', { notation: 'compact' }).format(videoInfo.views)
        : '';
      infoArtist = videoInfo.author?.name || '';
    }

    // Send info card RIGHT NOW — user sees it immediately
    const infoCaption =
      `🎵 *${infoTitle}*\n` +
      (infoArtist ? `👤 ${infoArtist}\n` : '') +
      (infoDur    ? `⏱️ ${infoDur}\n`    : '') +
      (infoViews  ? `👁️ ${infoViews} views\n` : '') +
      `\n⏳ _Downloading audio..._\n\n> 💫 *INFINITY MD*`;

    if (infoThumb) {
      sock.sendMessage(chatId, {
        image: { url: infoThumb },
        caption: infoCaption,
      }, { quoted: msg }).catch(() => {});
    } else {
      sock.sendMessage(chatId, { text: infoCaption }, { quoted: msg }).catch(() => {});
    }

    /* ── STEP 2: Race all download APIs in parallel ── */
    let downloadUrl = null;
    const ytUrlForApis = isUrl
      ? query
      : (videoInfo?.url || null);

    try {
      if (ytUrlForApis) {
        downloadUrl = await fetchDownloadUrl(ytUrlForApis);
      } else {
        downloadUrl = await fetchDownloadUrlByQuery(query);
      }
    } catch (_) {
      // Last fallback: try by query if URL-based race failed
      if (ytUrlForApis) {
        try { downloadUrl = await fetchDownloadUrlByQuery(query); } catch (_2) {}
      }
    }

    if (!downloadUrl) {
      await react('❌');
      return reply(`❌ Could not find download link for *"${infoTitle}"*. Try another search.`);
    }

    /* ── STEP 3: Stream bytes → send audio buffer ── */
    let buf;
    try {
      buf = await streamToBuffer(downloadUrl);
    } catch (e) {
      console.error('[Song] URL download error, trying ytdl stream:', e.message);
      // Final fallback: stream directly via ytdl-core if we have a YouTube URL
      if (ytUrlForApis) {
        try {
          buf = await streamToBufferYtdl(ytUrlForApis);
        } catch (e2) {
          console.error('[Song] ytdl stream error:', e2.message);
        }
      }
      if (!buf) {
        await react('❌');
        return reply('❌ Failed to download audio. Please try again.');
      }
    }

    const safeTitle = infoTitle.replace(/[^\w\s-]/g, '').trim() || 'audio';

    try {
      await sock.sendMessage(chatId, {
        audio: buf,
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`,
        ptt: false,
      }, { quoted: msg });
      await react('✅');
      setCache(query, { buf, title: infoTitle, thumbnail: infoThumb, duration: infoDur });
    } catch (e) {
      console.error('[Song] Send error:', e.message);
      await react('❌');
      reply('❌ Failed to send audio. Please try again.');
    }
  },
};
