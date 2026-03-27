const axios = require('axios');

module.exports = {
  name: 'cuddle',
  aliases: ['animecuddle'],
  category: 'anime',
  desc: 'Send a cuddle anime GIF',
  usage: 'cuddle [@user]',
  execute: async (sock, msg, args, extra) => {
    try {
      const response = await axios.get('https://api.waifu.pics/sfw/cuddle', {
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

      let mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      let caption = '🤗 *Cuddle~* 🤗';
      if (mentionedJid.length > 0) {
        const mentionedName = mentionedJid[0].split('@')[0];
        caption = `🤗 *@${mentionedName} gets a cuddle~* 🤗`;
      }

      const isGif = imageUrl.endsWith('.gif');
      if (isGif) {
        await sock.sendMessage(extra.from, {
          video: imageBuffer,
          caption,
          gifPlayback: true,
          mentions: mentionedJid
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, {
          image: imageBuffer,
          caption,
          mentions: mentionedJid
        }, { quoted: msg });
      }
    } catch (error) {
      console.error('Error in cuddle command:', error);
      if (error.response?.status === 429) {
        await extra.reply('❌ Rate limit exceeded. Please try again later.');
      } else if (error.code === 'ECONNABORTED') {
        await extra.reply('❌ Request timed out. Please try again.');
      } else {
        await extra.reply('❌ Failed to fetch cuddle GIF. Please try again.');
      }
    }
  }
};
