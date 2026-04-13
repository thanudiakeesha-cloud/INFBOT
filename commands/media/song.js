const axios = require('axios');
const yts = require('yt-search');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'xbps-install-Syu';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const downloadWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.get(DL_API, {
        params: { apiKey: API_KEY, format: 'mp3', url },
        timeout: 90000
      });
      if (data?.data?.downloadUrl) return data.data;
      throw new Error('No download URL');
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Download attempt ${i + 1} failed, retrying in 5s...`);
      await wait(5000);
    }
  }
  throw new Error('All download attempts failed');
};

module.exports = {
  name: 'song',
  aliases: ['music', 'audio', 'mp3'],
  category: 'media',
  description: 'Download song from YouTube (MP3)',
  usage: '.song <song name | youtube link>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query)
      return sock.sendMessage(chatId, {
        text: '🎵 *Song Downloader*\n\nUsage:\n.song <song name | YouTube link>'
      }, { quoted: msg });

    try {
      let video;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        video = { url: query };
      } else {
        const { videos } = await yts(query);
        if (!videos?.length)
          return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: msg });
        video = videos[0];
      }

      if (video.thumbnail) {
        await sock.sendMessage(chatId, {
          image: { url: video.thumbnail },
          caption: `🎶 *${video.title || query}*\n⏱ ${video.timestamp || ''}\n\n⏳ Downloading... *(may take up to 30s)*`
        }, { quoted: msg });
      }

      const audio = await downloadWithRetry(video.url);

      await sock.sendMessage(chatId, {
        audio: { url: audio.downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${audio.title || video.title || 'song'}.mp3`,
        ptt: false
      }, { quoted: msg });

    } catch (err) {
      console.error('Song plugin error:', err.message);
      const isConnErr = err.message?.includes('Connection Closed') || err.message?.includes('Connection Reset') || err.output?.statusCode === 428;
      if (isConnErr) {
        console.warn('Song: socket closed during download — skipping reply.');
        return;
      }
      const reason = err.response?.status === 408
        ? 'Download timed out. Try again.'
        : err.message;
      try {
        await sock.sendMessage(chatId, { text: `❌ Failed: ${reason}` }, { quoted: msg });
      } catch (_) {}
    }
  }
};
