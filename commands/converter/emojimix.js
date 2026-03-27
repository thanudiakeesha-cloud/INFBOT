const axios = require('axios');

module.exports = {
  name: 'emojimix',
  aliases: ['mixemoji', 'emix'],
  category: 'converter',
  description: 'Mix two emojis together',
  usage: '.emojimix 😀+😎',

  async execute(sock, msg, args, extra) {
    try {
      const text = args.join(' ');
      if (!text || !text.includes('+')) {
        return await extra.reply('📎 Usage: .emojimix 😀+😎\n\nCombine two emojis with a + sign!');
      }

      const parts = text.split('+').map(s => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        return await extra.reply('📎 Usage: .emojimix 😀+😎\n\nProvide two emojis separated by +');
      }

      const emoji1 = parts[0];
      const emoji2 = parts[1];

      const codePoint1 = [...emoji1].map(c => c.codePointAt(0).toString(16)).join('-');
      const codePoint2 = [...emoji2].map(c => c.codePointAt(0).toString(16)).join('-');

      const url = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${codePoint1}/u${codePoint1}_u${codePoint2}.png`;

      let res;
      try {
        res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      } catch {
        const url2 = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${codePoint2}/u${codePoint2}_u${codePoint1}.png`;
        res = await axios.get(url2, { responseType: 'arraybuffer', timeout: 15000 });
      }

      const imageBuffer = Buffer.from(res.data);

      await sock.sendMessage(extra.from, {
        image: imageBuffer,
        caption: `${emoji1} + ${emoji2} = ✨`
      }, { quoted: msg });
    } catch (error) {
      console.error('emojimix error:', error);
      await extra.reply('❌ Failed to mix emojis. This combination may not be supported.');
    }
  }
};
