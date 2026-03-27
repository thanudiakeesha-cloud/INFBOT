const axios = require('axios');

module.exports = {
  name: 'wallpaper',
  aliases: ['wall', 'wp'],
  category: 'media',
  description: 'Search and download wallpapers',
  usage: '.wallpaper <search query>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a search query.\n\nUsage: .wallpaper <search query>'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      let images = [];

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/s/wallpaper?query=${encodeURIComponent(query)}`, {
          timeout: 30000
        });
        if (response.data?.data && Array.isArray(response.data.data)) {
          images = response.data.data;
        }
      } catch (e) {}

      if (!images || images.length === 0) {
        try {
          const response2 = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query + ' wallpaper')}`, {
            timeout: 30000
          });
          if (response2.data?.data && Array.isArray(response2.data.data)) {
            images = response2.data.data;
          }
        } catch (e) {}
      }

      if (!images || images.length === 0) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        return await sock.sendMessage(chatId, {
          text: '❌ No wallpapers found for: ' + query
        }, { quoted: msg });
      }

      const selected = images.slice(0, 3);

      for (const imgUrl of selected) {
        const url = typeof imgUrl === 'string' ? imgUrl : imgUrl.url || imgUrl.image;
        if (url) {
          try {
            await sock.sendMessage(chatId, {
              image: { url },
              caption: `🖼️ *Wallpaper* - ${query}\n\n> 💫 *INFINITY MD*`
            }, { quoted: msg });
          } catch (e) {
            console.error('[WALLPAPER] Send error:', e?.message);
          }
        }
      }

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

    } catch (error) {
      console.error('[WALLPAPER] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Failed to search wallpapers: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
