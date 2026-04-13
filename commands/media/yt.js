/**
 * YouTube Search & Download
 * Supports: search query, direct URL (including Shorts)
 */

const axios = require('axios');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const APIs = require('../../utils/api');
const { sendBtn, btn } = require('../../utils/sendBtn');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;
const LOADER_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const LOADER_KEY = process.env.SONG_DOWNLOAD_API_KEY || 'xbps-install-Syu';

// Store pending search results per sender (expires after 5 minutes)
const pendingSearches = new Map();
const PENDING_TTL = 5 * 60 * 1000;

function storePending(senderJid, videos) {
  pendingSearches.set(senderJid, { videos, ts: Date.now() });
}

function getPending(senderJid) {
  const entry = pendingSearches.get(senderJid);
  if (!entry) return null;
  if (Date.now() - entry.ts > PENDING_TTL) {
    pendingSearches.delete(senderJid);
    return null;
  }
  return entry.videos;
}

function normalizeYouTubeUrl(input) {
  const match = String(input || '').match(YT_REGEX);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : input;
}

function extractVideo(data) {
  const item = data?.data || data?.result || data;
  const downloadUrl =
    item?.downloadUrl ||
    item?.download ||
    item?.download_url ||
    item?.dl ||
    item?.mp4 ||
    item?.url;
  if (!downloadUrl) return null;
  return {
    download: downloadUrl,
    title: item?.title || item?.name,
    thumbnail: item?.thumbnail || item?.thumb
  };
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*'
    }
  });
  return Buffer.from(res.data);
}

async function getLoaderVideoByUrl(videoUrl) {
  const normalizedUrl = normalizeYouTubeUrl(videoUrl);
  const formats = ['360', '480', '720', 'mp4'];
  let lastError;

  for (const format of formats) {
    try {
      const res = await axios.get(LOADER_API, {
        timeout: 90000,
        params: { apiKey: LOADER_KEY, format, url: normalizedUrl },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*'
        }
      });
      const parsed = extractVideo(res.data);
      if (parsed?.download) return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Loader returned no video download');
}

async function getYtdlVideoByUrl(videoUrl) {
  const normalizedUrl = normalizeYouTubeUrl(videoUrl);
  const info = await ytdl.getInfo(normalizedUrl, {
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }
  });
  const finalTitle = info.videoDetails?.title || 'YouTube Video';
  const formats = ytdl.filterFormats(info.formats, f =>
    f.container === 'mp4' && f.hasVideo && f.hasAudio && f.url
  );
  formats.sort((a, b) => (parseInt(b.height) || 0) - (parseInt(a.height) || 0));
  const best = formats.find(f => (f.height || 0) <= 720) || formats[0];
  if (!best?.url) throw new Error('No suitable ytdl format found');
  return { download: best.url, title: finalTitle };
}

async function downloadVideoByUrl(videoUrl, videoTitle, sock, msg, chatId, react, reply) {
  await react('⏳');
  videoUrl = normalizeYouTubeUrl(videoUrl);

  // Get video thumbnail from URL
  const ytIdMatch = videoUrl.match(YT_REGEX);
  const ytId = ytIdMatch ? ytIdMatch[1] : null;
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null;

  if (thumb) {
    try {
      await sock.sendMessage(chatId, {
        image: { url: thumb },
        caption: `🎬 *${videoTitle || 'YouTube Video'}*\n⏳ _Downloading..._\n\n> 💫 *INFINITY MD*`
      }, { quoted: msg });
    } catch (e) {}
  }

  let downloadUrl = null;
  let finalTitle = videoTitle || 'YouTube Video';

  try {
    const result = await getYtdlVideoByUrl(videoUrl);
    downloadUrl = result?.download;
    finalTitle = result?.title || finalTitle;
    console.log('[YT] @distube/ytdl-core OK:', downloadUrl?.substring(0, 60));
  } catch (e1) {
    console.log('[YT] @distube/ytdl-core FAIL:', e1.message);
  }

  if (!downloadUrl) {
    try {
      const result = await getLoaderVideoByUrl(videoUrl);
      downloadUrl = result?.download;
      finalTitle = result?.title || finalTitle;
      console.log('[YT] Loader OK:', downloadUrl?.substring(0, 60));
    } catch (e2) {
      console.log('[YT] Loader FAIL:', e2.message);
    }
  }

  if (!downloadUrl) {
    try {
      const result = await APIs.getEliteProTechVideoByUrl(videoUrl);
      downloadUrl = result?.download;
      finalTitle = result?.title || finalTitle;
      console.log('[YT] EliteProTech OK:', downloadUrl?.substring(0, 60));
    } catch (e3) {
      console.log('[YT] EliteProTech FAIL:', e3.message);
    }
  }

  if (!downloadUrl) {
    try {
      const result = await APIs.getYupraVideoByUrl(videoUrl);
      downloadUrl = result?.download;
      finalTitle = result?.title || finalTitle;
      console.log('[YT] Yupra OK:', downloadUrl?.substring(0, 60));
    } catch (e4) {
      console.log('[YT] Yupra FAIL:', e4.message);
    }
  }

  if (!downloadUrl) {
    try {
      const result = await APIs.getOkatsuVideoByUrl(videoUrl);
      downloadUrl = result?.download;
      finalTitle = result?.title || finalTitle;
      console.log('[YT] Okatsu OK:', downloadUrl?.substring(0, 60));
    } catch (e5) {
      console.log('[YT] Okatsu FAIL:', e5.message);
    }
  }

  if (!downloadUrl) {
    await react('❌');
    return reply('❌ Failed to get video download link. All sources failed — please try again later.');
  }

  const safeTitle = finalTitle.replace(/[^\w\s-]/g, '').trim() || 'video';

  // Send via URL directly — avoids buffering large files over the WA connection
  try {
    await sock.sendMessage(chatId, {
      video: { url: downloadUrl },
      mimetype: 'video/mp4',
      fileName: `${safeTitle}.mp4`,
      caption: `🎬 *${finalTitle}*\n\n> 💫 *INFINITY MD*`
    }, { quoted: msg });
    await react('✅');
  } catch (urlErr) {
    console.log('[YT] URL send FAIL, trying buffer:', urlErr.message);
    // Last resort: download to buffer and send
    try {
      const videoBuffer = await downloadBuffer(downloadUrl);
      console.log('[YT] Buffer size:', Math.round(videoBuffer.length / 1024 / 1024) + ' MB');
      await sock.sendMessage(chatId, {
        video: videoBuffer,
        mimetype: 'video/mp4',
        fileName: `${safeTitle}.mp4`,
        caption: `🎬 *${finalTitle}*\n\n> 💫 *INFINITY MD*`
      }, { quoted: msg });
      await react('✅');
    } catch (bufErr) {
      console.log('[YT] Buffer send FAIL:', bufErr.message);
      await react('❌');
      return reply('❌ Failed to send video. File may be too large or the link expired.');
    }
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
      // Handle button pick selection: .yt pick <index>
      if (args[0] === 'pick') {
        const index = parseInt(args[1], 10);
        const videos = getPending(sender);
        if (!videos || isNaN(index) || index < 0 || index >= videos.length) {
          return reply('❌ Selection expired or invalid. Search again with .yt <query>');
        }
        const video = videos[index];
        return downloadVideoByUrl(video.url, video.title, sock, msg, chatId, react, reply);
      }

      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search query or YouTube link.\n\nUsage: .yt <search query>');

      // Detect if input is a direct YouTube URL (including Shorts)
      if (YT_REGEX.test(query)) {
        return downloadVideoByUrl(query, '', sock, msg, chatId, react, reply);
      }

      // Otherwise do a search
      await react('⏳');

      const { videos } = await yts(query);
      if (!videos || videos.length === 0) {
        await react('❌');
        return reply('❌ No YouTube videos found for that search.');
      }

      const results = videos.slice(0, 5);
      storePending(sender, results);

      const buttons = results.map((v, i) => {
        const label = (v.title || `Video ${i + 1}`).substring(0, 50);
        return btn(`yt_pick_${i}`, `${i + 1}. ${label}`);
      });

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
