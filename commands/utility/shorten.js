const APIs = require('../../utils/api');

module.exports = {
  name: 'shorten',
  aliases: ['short', 'tinyurl', 'shorturl'],
  category: 'utility',
  description: 'Shorten a URL using TinyURL',
  usage: '.shorten <url>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .shorten <url>\n\nExample: .shorten https://google.com');
      }

      const url = args[0];

      if (!/^https?:\/\//i.test(url)) {
        return extra.reply('❌ Please provide a valid URL starting with http:// or https://');
      }

      await extra.react('🔗');

      const shortened = await APIs.shortenUrl(url);

      const text = `╭━━〔 🔗 URL SHORTENER 〕━━⬣
┃ 📎 *Original:* ${url.length > 50 ? url.substring(0, 50) + '...' : url}
┃ ✅ *Shortened:* ${shortened}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
