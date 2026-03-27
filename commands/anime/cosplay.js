const axios = require('axios');

module.exports = {
  name: 'cosplay',
  aliases: ['cosplayer'],
  category: 'anime',
  desc: 'Get random anime cosplay images',
  usage: 'cosplay',
  execute: async (sock, msg, args, extra) => {
    try {
      const response = await axios.get('https://api.waifu.pics/sfw/waifu', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data || !response.data.url) {
        throw new Error('Invalid API response');
      }

      const imageUrl = response.data.url;
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const imageBuffer = Buffer.from(imageResponse.data);

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Empty image response');
      }

      await sock.sendMessage(extra.from, {
        image: imageBuffer,
        caption: '🎭 *Random Anime Cosplay* 🎭'
      }, { quoted: msg });
    } catch (error) {
      console.error('Error in cosplay command:', error);
      if (error.response?.status === 429) {
        await extra.reply('❌ Rate limit exceeded. Please try again later.');
      } else if (error.code === 'ECONNABORTED') {
        await extra.reply('❌ Request timed out. Please try again.');
      } else {
        await extra.reply('❌ Failed to fetch cosplay image. Please try again.');
      }
    }
  }
};
