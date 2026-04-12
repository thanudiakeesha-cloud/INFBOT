/**
 * YouTube Search & Download
 * Races all download APIs in parallel, streams buffer directly to WhatsApp.
 */

const axios = require('axios');
const yts = require('yt-search');
const { sendBtn, btn } = require('../../utils/sendBtn');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'video/*, */*',
};

// Pending search results per sender (5 min expiry)
const pendingSearches = new Map();
const PENDING_TTL = 5 * 60 * 1000;

function storePending(senderJid, videos) {
  pendingSearches.set(senderJid, { videos, ts: Date.now() });
}
function getPending(senderJid) {
  const entry = pendingSearches.get(senderJid);
  if (!entry) return null;
  if (Date.now() - entry.ts > PENDING_TTL) { pendingSearches.delete(senderJid); return null; }
  return entry.videos;
}

// Stream bytes from CDN URL into a buffer
async function streamToBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    headers: HEADERS,
    maxRedirects: 10,
  });
  return Buffer.from(res.data);
}

// Individual API callers — short timeouts, all race in parallel
async function tryEliteProVideo(url) {
  const res = await axios.get(
    `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`,
    { headers: HEADERS, timeout: 12000 }
  );
  if (res?.data?.success && res?.data?.downloadURL)
    return { download: res.data.downloadURL, title: res.data.title };
  throw new Error('no dl');
}

async function tryOkatsuVideo(url) {
  const res = await axios.get(
    `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  if (res?.data?.result?.mp4)
    return { download: res.data.result.mp4, title: res.data.result.title };
  throw new Error('no dl');
}

async function tryYupraVideo(url) {
  const res = await axios.get(
    `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  if (res?.data?.success && res?.data?.data?.download_url)
    return { download: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail };
  throw new Error('no dl');
}

async function tryVredenVideo(url) {
  const res = await axios.get(
    `https://api.vreden.my.id/api/ytmp4?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.result || res?.data?.data;
  if (d?.download || d?.url || d?.mp4)
    return { download: d.download || d.url || d.mp4, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

async function tryAgatzVideo(url) {
  const res = await axios.get(
    `https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 12000 }
  );
  const d = res?.data?.data;
  if (d?.video || d?.url || d?.download)
    return { download: d.video || d.url || d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('no dl');
}

// Race all video download APIs simultaneously
async function fetchVideoByUrl(url) {
  return Promise.any([
    tryEliteProVideo(url),
    tryOkatsuVideo(url),
    tryYupraVideo(url),
    tryVredenVideo(url),
    tryAgatzVideo(url),
  ]);
}

async function downloadVideoByUrl(videoUrl, videoTitle, sock, msg, chatId, react, reply) {
  await react('⏳');

  const ytIdMatch = videoUrl.match(YT_REGEX);
  const ytId = ytIdMatch ? ytIdMatch[1] : null;
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null;

  // Send thumbnail immediately while fetching download link
  if (thumb) {
    sock.sendMessage(chatId, {
      image: { url: thumb },
      caption: `🎬 *${videoTitle || 'YouTube Video'}*\n⏳ _Downloading..._\n\n> 💫 *INFINITY MD*`
    }, { quoted: msg }).catch(() => {});
  }

  // Get download URL (parallel race)
  let result = null;
  try {
    result = await fetchVideoByUrl(videoUrl);
  } catch (e) {
    console.error('[YT] All APIs failed:', e.message);
    await react('❌');
    return reply('❌ Could not get video download link. Please try again later.');
  }

  const finalTitle = result.title || videoTitle || 'YouTube Video';
  const safeTitle  = finalTitle.replace(/[^\w\s-]/g, '').trim() || 'video';

  // Stream bytes from CDN into buffer
  let buf;
  try {
    buf = await streamToBuffer(result.download);
  } catch (e) {
    console.error('[YT] Buffer download failed:', e.message);
    await react('❌');
    return reply('❌ Failed to download video. File may be too large or the link expired.');
  }

  // Send buffer directly to WhatsApp chat
  try {
    await sock.sendMessage(chatId, {
      video: buf,
      mimetype: 'video/mp4',
      fileName: `${safeTitle}.mp4`,
      caption: `🎬 *${finalTitle}*\n\n> 💫 *INFINITY MD*`
    }, { quoted: msg });
    await react('✅');
  } catch (e) {
    console.error('[YT] Send error:', e.message);
    await react('❌');
    reply('❌ Failed to send video. Please try again.');
  }
}

module.exports = {
  name: 'yt',
  aliases: ['youtube', 'ytsearch'],
  category: 'media',
  description: 'Search YouTube and download video (or pass a direct link)',
  usage: '.yt <search query or YouTube URL>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      // Button pick: .yt pick <index>
      if (args[0] === 'pick') {
        const index = parseInt(args[1], 10);
        const videos = getPending(sender);
        if (!videos || isNaN(index) || index < 0 || index >= videos.length)
          return reply('❌ Selection expired or invalid. Search again with .yt <query>');
        return downloadVideoByUrl(videos[index].url, videos[index].title, sock, msg, chatId, react, reply);
      }

      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search query or YouTube link.\n\nUsage: .yt <search query>');

      // Direct YouTube URL
      if (YT_REGEX.test(query))
        return downloadVideoByUrl(query, '', sock, msg, chatId, react, reply);

      // Search
      await react('⏳');
      const { videos } = await yts(query);
      if (!videos || videos.length === 0) {
        await react('❌');
        return reply('❌ No YouTube videos found for that search.');
      }

      const results = videos.slice(0, 5);
      storePending(sender, results);

      const buttons = results.map((v, i) =>
        btn(`yt_pick_${i}`, `${i + 1}. ${(v.title || `Video ${i + 1}`).substring(0, 50)}`)
      );

      await react('✅');
      await sendBtn(sock, from, {
        title: '🎬 YouTube Search Results',
        text:
          `🔍 *Query:* ${query}\n` +
          `📊 Found *${results.length}* videos\n\n` +
          `👇 Tap a title to download it:`,
        footer: `♾️ Infinity MD • Results expire in 5 min`,
        buttons,
      }, { quoted: msg });

    } catch (err) {
      console.error('[YT] Error:', err?.message || err);
      await react('❌');
      reply('❌ Failed. Please try again later.');
    }
  }
};
