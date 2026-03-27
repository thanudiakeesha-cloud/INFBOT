const yts = require('yt-search');
const axios = require('axios');

module.exports = {
  name: 'play',
  aliases: ['playsong', 'p'],
  category: 'media',
  description: 'Play a song by searching its name',
  usage: '.play <song name>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a song name.\n\nUsage: .play <song name>'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      const { videos } = await yts(query);
      if (!videos || videos.length === 0) {
        return await sock.sendMessage(chatId, {
          text: '❌ No results found for: ' + query
        }, { quoted: msg });
      }

      const video = videos[0];

      await sock.sendMessage(chatId, {
        image: { url: video.thumbnail },
        caption: `🎵 *${video.title}*\n👤 ${video.author.name}\n⏱ ${video.timestamp}\n👁 ${video.views}\n🔗 ${video.url}\n\n_Downloading audio..._\n\n> 💫 *INFINITY MD*`
      }, { quoted: msg });

      const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(video.url)}`;
      const response = await axios.get(apiUrl, { timeout: 60000 });

      if (!response.data || !response.data.data || !response.data.data.dl) {
        const fallbackApi = `https://api.qasimdev.dpdns.org/api/youtube/download?apiKey=qasim-dev&url=${encodeURIComponent(video.url)}&format=mp3`;
        const fallbackRes = await axios.get(fallbackApi, { timeout: 60000 });

        if (!fallbackRes.data?.success || !fallbackRes.data?.data?.download) {
          return await sock.sendMessage(chatId, {
            text: '❌ Failed to download audio.'
          }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
          audio: { url: fallbackRes.data.data.download },
          mimetype: 'audio/mpeg',
          fileName: `${video.title.replace(/[^\w\s-]/g, '')}.mp3`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, {
          audio: { url: response.data.data.dl },
          mimetype: 'audio/mpeg',
          fileName: `${video.title.replace(/[^\w\s-]/g, '')}.mp3`
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

    } catch (error) {
      console.error('[PLAY] Error:', error?.message || error);
      await sock.sendMessage(chatId, {
        react: { text: '❌', key: msg.key }
      });
      await sock.sendMessage(chatId, {
        text: '❌ Failed to play song: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
