const axios = require('axios');

module.exports = {
  name: 'pinterest',
  aliases: ['pin', 'pinimg'],
  category: 'media',
  description: 'Search images from Pinterest',
  usage: '.pinterest <search query>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a search query.\n\nUsage: .pinterest <search query>'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      let images = [];

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`, {
          timeout: 30000
        });
        if (response.data?.data && Array.isArray(response.data.data)) {
          images = response.data.data;
        }
      } catch (e) {}

      if (!images || images.length === 0) {
        try {
          const response2 = await axios.get(`https://api.qasimdev.dpdns.org/api/search/pinterest?apiKey=qasim-dev&query=${encodeURIComponent(query)}`, {
            timeout: 30000
          });
          if (response2.data?.success && response2.data?.data) {
            images = response2.data.data;
          }
        } catch (e) {}
      }

      if (!images || images.length === 0) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        return await sock.sendMessage(chatId, {
          text: '❌ No images found for: ' + query
        }, { quoted: msg });
      }

      const selected = images.slice(0, 5);

      for (const imgUrl of selected) {
        const url = typeof imgUrl === 'string' ? imgUrl : imgUrl.url || imgUrl.image;
        if (url) {
          try {
            await sock.sendMessage(chatId, {
              image: { url },
              caption: `📌 *Pinterest* - ${query}\n\n> 💫 *INFINITY MD*`
            }, { quoted: msg });
          } catch (e) {
            console.error('[PINTEREST] Send error:', e?.message);
          }
        }
      }

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

    } catch (error) {
      console.error('[PINTEREST] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Failed to search Pinterest: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
