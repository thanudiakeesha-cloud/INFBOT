/**
 * YouTube Search & Download (Video)
 * Uses @distube/ytdl-core for reliable direct YouTube access.
 */

const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const { sendBtn, btn } = require('../../utils/sendBtn');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

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

async function downloadVideoByUrl(videoUrl, videoTitle, sock, msg, chatId, react, reply) {
  await react('⏳');

  const ytIdMatch = videoUrl.match(YT_REGEX);
  const ytId = ytIdMatch ? ytIdMatch[1] : null;
  const thumb = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null;

  let info;
  try {
    info = await ytdl.getInfo(videoUrl);
  } catch (e) {
    console.error('[YT] getInfo failed:', e.message);
    await react('❌');
    return reply('❌ Could not fetch video info. Please try again.');
  }

  const title = info.videoDetails.title || videoTitle || 'YouTube Video';
  const safeTitle = title.replace(/[^\w\s-]/g, '').trim() || 'video';
  const duration = parseInt(info.videoDetails.lengthSeconds || 0);

  if (duration > 600) {
    await react('❌');
    return reply('❌ Video is too long (max 10 minutes). Try a shorter video.');
  }

  if (thumb) {
    sock.sendMessage(chatId, {
      image: { url: thumb },
      caption: `🎬 *${title}*\n⏳ _Downloading... (may take 15–30s)_\n\n> 💫 *INFINITY MD*`
    }, { quoted: msg }).catch(() => {});
  }

  const format = ytdl.chooseFormat(info.formats, {
    quality: 'highestvideo',
    filter: f => f.container === 'mp4' && f.hasAudio && f.hasVideo
  }) || ytdl.chooseFormat(info.formats, { quality: '18' });

  if (!format || !format.url) {
    await react('❌');
    return reply('❌ No suitable video format found. Try a different video.');
  }

  try {
    const res = await axios.get(format.url, {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const buf = Buffer.from(res.data);

    await sock.sendMessage(chatId, {
      video: buf,
      mimetype: 'video/mp4',
      fileName: `${safeTitle}.mp4`,
      caption: `🎬 *${title}*\n\n> 💫 *INFINITY MD*`
    }, { quoted: msg });
    await react('✅');
  } catch (e) {
    console.error('[YT] Download/send error:', e.message);
    const isConnErr = e.message?.includes('Connection Closed') || e.message?.includes('Connection Reset');
    if (isConnErr) return;
    await react('❌');
    try { reply('❌ Failed to download video. File may be too large.'); } catch (_) {}
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
      if (args[0] === 'pick') {
        const index = parseInt(args[1], 10);
        const videos = getPending(sender);
        if (!videos || isNaN(index) || index < 0 || index >= videos.length)
          return reply('❌ Selection expired or invalid. Search again with .yt <query>');
        return downloadVideoByUrl(videos[index].url, videos[index].title, sock, msg, chatId, react, reply);
      }

      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search query or YouTube link.\n\nUsage: .yt <search query>');

      if (YT_REGEX.test(query))
        return downloadVideoByUrl(query, '', sock, msg, chatId, react, reply);

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
      try { reply('❌ Failed. Please try again later.'); } catch (_) {}
    }
  }
};
