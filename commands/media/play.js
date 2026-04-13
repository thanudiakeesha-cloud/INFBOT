const yts = require('yt-search');
const axios = require('axios');

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
  name: 'play',
  aliases: ['plays', 'music'],
  category: 'media',
  description: 'Search and download a song as MP3 from YouTube',
  usage: '.play <song name>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query)
      return sock.sendMessage(chatId, {
        text: '*Which song do you want to play?*\nUsage: .play <song name>'
      }, { quoted: msg });

    try {
      await sock.sendMessage(chatId, { text: '🔍 *Searching...*' }, { quoted: msg });

      const { videos } = await yts(query);
      if (!videos?.length)
        return sock.sendMessage(chatId, { text: '❌ *No results found!*' }, { quoted: msg });

      const video = videos[0];

      await sock.sendMessage(chatId, {
        text: `✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading... (this may take up to 30s)*`
      }, { quoted: msg });

      const songData = await downloadWithRetry(video.url);

      let thumbnailBuffer;
      try {
        const img = await axios.get(songData.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
        thumbnailBuffer = Buffer.from(img.data);
      } catch { /* no thumbnail */ }

      await sock.sendMessage(chatId, {
        audio: { url: songData.downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${songData.title}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: songData.title,
            body: `${video.author.name} • ${video.timestamp}`,
            thumbnail: thumbnailBuffer,
            mediaType: 2,
            sourceUrl: video.url
          }
        }
      }, { quoted: msg });

    } catch (err) {
      console.error('Play error:', err.message);
      const isConnErr = err.message?.includes('Connection Closed') || err.message?.includes('Connection Reset') || err.output?.statusCode === 428;
      if (isConnErr) {
        console.warn('Play: socket closed during download — skipping reply.');
        return;
      }
      const reason = err.response?.status === 408
        ? 'Download timed out. Try again in a moment.'
        : err.response?.status === 429
          ? 'Rate limited. Wait a minute.'
          : err.message;
      try {
        await sock.sendMessage(chatId, { text: `❌ *Failed:* ${reason}` }, { quoted: msg });
      } catch (_) {}
    }
  }
};
