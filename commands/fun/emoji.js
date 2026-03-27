module.exports = {
  name: 'emojimix',
  aliases: ['mixemoji', 'emix'],
  category: 'fun',
  description: 'Mix two emojis together to create a new one',
  usage: '.emojimix <emoji1> <emoji2>',

  async execute(sock, msg, args, extra) {
    try {
      const axios = require('axios');

      const text = args.join(' ');
      const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
      const emojis = text.match(emojiRegex);

      if (!emojis || emojis.length < 2) {
        return extra.reply('❌ Usage: .emojimix <emoji1> <emoji2>\n\nExample: .emojimix 😀 🔥');
      }

      const emoji1 = emojis[0];
      const emoji2 = emojis[1];

      await extra.react('🎨');

      const codePoint1 = [...emoji1].map(c => c.codePointAt(0).toString(16)).join('-');
      const codePoint2 = [...emoji2].map(c => c.codePointAt(0).toString(16)).join('-');

      const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

      const response = await axios.get(url, { timeout: 15000 });

      if (!response.data?.results?.length) {
        return extra.reply(`❌ Could not mix ${emoji1} + ${emoji2}. Not all combinations work. Try different emojis!`);
      }

      const imageUrl = response.data.results[0].media_formats?.png_transparent?.url;
      if (!imageUrl) {
        return extra.reply(`❌ Could not get image for ${emoji1} + ${emoji2}.`);
      }

      await sock.sendMessage(extra.from, {
        sticker: { url: imageUrl }
      }, { quoted: msg });

    } catch (error) {
      await extra.reply(`❌ Error mixing emojis: ${error.message}`);
    }
  }
};
