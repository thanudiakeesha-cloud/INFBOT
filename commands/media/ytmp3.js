const axios = require('axios');

module.exports = {
  name: 'ytmp3',
  aliases: ['yta', 'ytaudio'],
  category: 'media',
  description: 'Download YouTube video as MP3 audio',
  usage: '.ytmp3 <youtube URL>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const url = args[0]?.trim();
      if (!url) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a YouTube URL.\n\nUsage: .ytmp3 <youtube URL>'
        }, { quoted: msg });
      }

      const ytRegex = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/;
      if (!ytRegex.test(url)) {
        return await sock.sendMessage(chatId, {
          text: '❌ Invalid YouTube URL.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      await sock.sendMessage(chatId, {
        text: '🎵 _Downloading audio from YouTube..._'
      }, { quoted: msg });

      let downloadUrl, title;

      try {
        const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });
        if (response.data?.data?.dl) {
          downloadUrl = response.data.data.dl;
          title = response.data.data.title || 'audio';
        }
      } catch (e) {}

      if (!downloadUrl) {
        const fallbackApi = `https://api.qasimdev.dpdns.org/api/youtube/download?apiKey=qasim-dev&url=${encodeURIComponent(url)}&format=mp3`;
        const fallbackRes = await axios.get(fallbackApi, { timeout: 60000 });
        if (fallbackRes.data?.success && fallbackRes.data?.data?.download) {
          downloadUrl = fallbackRes.data.data.download;
          title = fallbackRes.data.data.title || 'audio';
        }
      }

      if (!downloadUrl) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        return await sock.sendMessage(chatId, {
          text: '❌ Failed to download audio.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${(title || 'audio').replace(/[^\w\s-]/g, '')}.mp3`
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

    } catch (error) {
      console.error('[YTMP3] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Download failed: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
