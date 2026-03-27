module.exports = {
  name: 'hash',
  aliases: ['md5', 'sha1', 'sha256'],
  category: 'utility',
  description: 'Hash text using md5, sha1, or sha256',
  usage: '.hash <algorithm> <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage: .hash <md5|sha1|sha256> <text>\n\nExample:\n.hash md5 Hello World\n.hash sha256 Hello World');
      }

      const crypto = require('crypto');
      let algo = args[0].toLowerCase();
      const text = args.slice(1).join(' ');

      const validAlgos = ['md5', 'sha1', 'sha256', 'sha512'];
      if (!validAlgos.includes(algo)) {
        return extra.reply(`❌ Invalid algorithm! Use one of: ${validAlgos.join(', ')}`);
      }

      const hash = crypto.createHash(algo).update(text).digest('hex');

      const reply = `╭━━〔 #️⃣ HASH GENERATOR 〕━━⬣
┃ 📝 *Text:* ${text.length > 50 ? text.substring(0, 50) + '...' : text}
┃ 🔧 *Algorithm:* ${algo.toUpperCase()}
┃ 🔑 *Hash:* \`${hash}\`
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
