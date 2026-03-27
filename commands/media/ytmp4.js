/**
 * YouTube MP4 Downloader
 * Downloads a YouTube video by URL using multiple API fallbacks
 */

const axios = require('axios');
const APIs = require('../../utils/api');

module.exports = {
  name: 'ytmp4',
  aliases: ['ytdlv', 'ytdownload'],
  category: 'media',
  description: 'Download YouTube video as MP4',
  usage: '.ytmp4 <youtube URL>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const url = args[0]?.trim();
      if (!url) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a YouTube URL.\n\nUsage: .ytmp4 <youtube URL>'
        }, { quoted: msg });
      }

      const ytRegex = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/;
      if (!ytRegex.test(url)) {
        return await sock.sendMessage(chatId, {
          text: '❌ Invalid YouTube URL.\n\nExample: .ytmp4 https://youtube.com/watch?v=...'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '🎬 _Downloading video from YouTube..._'
      }, { quoted: msg });

      let downloadUrl = null;
      let title = null;

      // API 1: QasimDev
      if (!downloadUrl) {
        try {
          const res = await axios.get('https://api.qasimdev.dpdns.org/api/youtube/download', {
            timeout: 60000,
            params: { apiKey: 'qasim-dev', url, format: 360 }
          });
          if (res.data?.success && res.data?.data?.download) {
            downloadUrl = res.data.data.download;
            title = res.data.data.title;
          }
        } catch (e) {}
      }

      // API 2: EliteProTech
      if (!downloadUrl) {
        try {
          const result = await APIs.getEliteProTechVideoByUrl(url);
          if (result?.download) {
            downloadUrl = result.download;
            title = result.title;
          }
        } catch (e) {}
      }

      // API 3: Yupra
      if (!downloadUrl) {
        try {
          const result = await APIs.getYupraVideoByUrl(url);
          if (result?.download) {
            downloadUrl = result.download;
            title = result.title;
          }
        } catch (e) {}
      }

      // API 4: Okatsu
      if (!downloadUrl) {
        try {
          const result = await APIs.getOkatsuVideoByUrl(url);
          if (result?.download) {
            downloadUrl = result.download;
            title = result.title;
          }
        } catch (e) {}
      }

      // API 5: Siputzx
      if (!downloadUrl) {
        try {
          const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`, {
            timeout: 60000
          });
          if (res.data?.data?.dl) {
            downloadUrl = res.data.data.dl;
            title = res.data.data.title;
          }
        } catch (e) {}
      }

      if (!downloadUrl) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        return await sock.sendMessage(chatId, {
          text: '❌ Failed to download video. All download sources are currently unavailable.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName: `${(title || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
        caption: `🎬 *${title || 'Video'}*\n\n> 💫 *INFINITY MD*`
      }, { quoted: msg });

      await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

    } catch (error) {
      console.error('[YTMP4] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Download failed: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
