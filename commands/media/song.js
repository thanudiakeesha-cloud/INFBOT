/**
 * Song Download
 * Searches YouTube and downloads audio as MP3
 * Supports: search query or direct YouTube URL (including Shorts)
 */

const axios = require('axios');
const yts = require('yt-search');
const APIs = require('../../utils/api');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

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

async function getAudioByUrl(youtubeUrl) {
  let result = null;

  // Try Izumi
  try {
    result = await APIs.getIzumiDownloadByUrl(youtubeUrl);
    if (result?.download) { console.log('[SONG] Izumi URL OK'); return result; }
  } catch (e) { console.log('[SONG] Izumi URL FAIL:', e.message); }

  // Try EliteProTech
  try {
    result = await APIs.getEliteProTechDownloadByUrl(youtubeUrl);
    if (result?.download) { console.log('[SONG] EliteProTech OK'); return result; }
  } catch (e) { console.log('[SONG] EliteProTech FAIL:', e.message); }

  // Try Yupra
  try {
    result = await APIs.getYupraDownloadByUrl(youtubeUrl);
    if (result?.download) { console.log('[SONG] Yupra OK'); return result; }
  } catch (e) { console.log('[SONG] Yupra FAIL:', e.message); }

  // Try Okatsu
  try {
    result = await APIs.getOkatsuDownloadByUrl(youtubeUrl);
    if (result?.download) { console.log('[SONG] Okatsu OK'); return result; }
  } catch (e) { console.log('[SONG] Okatsu FAIL:', e.message); }

  return null;
}

async function getAudioByQuery(query) {
  let result = null;

  // Try Izumi search
  try {
    result = await APIs.getIzumiDownloadByQuery(query);
    if (result?.download) { console.log('[SONG] Izumi Query OK'); return result; }
  } catch (e) { console.log('[SONG] Izumi Query FAIL:', e.message); }

  // Fallback: use yt-search to get URL, then download by URL
  try {
    const { videos } = await yts(query);
    if (videos && videos.length > 0) {
      const topVideo = videos[0];
      console.log('[SONG] yt-search found:', topVideo.title);
      result = await getAudioByUrl(topVideo.url);
      if (result) {
        result.title = result.title || topVideo.title;
        result.thumbnail = result.thumbnail || (topVideo.videoId ? `https://i.ytimg.com/vi/${topVideo.videoId}/sddefault.jpg` : null);
        result.duration = topVideo.duration?.timestamp || '';
        return result;
      }
    }
  } catch (e) { console.log('[SONG] yts fallback FAIL:', e.message); }

  return null;
}

module.exports = {
  name: 'song',
  aliases: ['music', 'mp3', 'audio', 'play'],
  category: 'media',
  description: 'Search YouTube and download as audio/song',
  usage: '.song <song name or YouTube URL>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;
    const chatId = msg.key.remoteJid;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return reply('❌ Please provide a song name or YouTube link.\n\nUsage: `.song <song name>`');
      }

      await react('⏳');
      await sock.sendMessage(chatId, {
        text: `🎵 _Searching for:_ *${query}*\n_Please wait..._`
      }, { quoted: msg });

      let result = null;
      let isDirectUrl = YT_REGEX.test(query);

      if (isDirectUrl) {
        result = await getAudioByUrl(query);
        // If URL lookup fails, also try query-based
        if (!result) result = await getAudioByQuery(query);
      } else {
        result = await getAudioByQuery(query);
      }

      if (!result || !result.download) {
        await react('❌');
        return reply('❌ Could not find or download that song. Please try another name or link.');
      }

      const title = result.title || query;
      const thumb = result.thumbnail || null;
      const duration = result.duration || '';
      const safeTitle = title.replace(/[^\w\s-]/g, '').trim() || 'audio';

      // Send thumbnail card
      if (thumb) {
        try {
          await sock.sendMessage(chatId, {
            image: { url: thumb },
            caption: `🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n⬇️ _Sending audio..._\n\n> 💫 *INFINITY MD*`
          }, { quoted: msg });
        } catch (e) {}
      }

      // Send audio via URL directly — avoids buffering large files over the WA connection
      try {
        await sock.sendMessage(chatId, {
          audio: { url: result.download },
          mimetype: 'audio/mpeg',
          fileName: `${safeTitle}.mp3`,
          ptt: false
        }, { quoted: msg });
        await react('✅');
      } catch (urlErr) {
        console.log('[SONG] URL send FAIL, trying buffer:', urlErr.message);
        // Fallback: download as buffer and retry
        try {
          const audioBuffer = await downloadBuffer(result.download);
          console.log('[SONG] Buffer size:', audioBuffer.length);
          await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false
          }, { quoted: msg });
          await react('✅');
        } catch (bufErr) {
          console.log('[SONG] Buffer send FAIL:', bufErr.message);
          await react('❌');
          return reply('❌ Failed to send audio. Please try again.');
        }
      }

    } catch (err) {
      console.error('[SONG] Error:', err?.message || err);
      await react('❌');
      reply('❌ Failed to download song. Please try again later.');
    }
  }
};
