module.exports = {
  name: 'base64',
  aliases: ['b64', 'encode', 'decode'],
  category: 'utility',
  description: 'Encode or decode Base64 text',
  usage: '.base64 encode <text> | .base64 decode <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage:\n.base64 encode <text>\n.base64 decode <encoded text>\n\nExample:\n.base64 encode Hello World\n.base64 decode SGVsbG8gV29ybGQ=');
      }

      const action = args[0].toLowerCase();
      const text = args.slice(1).join(' ');

      let result;
      let label;

      if (action === 'encode' || action === 'enc' || action === 'e') {
        result = Buffer.from(text, 'utf-8').toString('base64');
        label = 'ENCODED';
      } else if (action === 'decode' || action === 'dec' || action === 'd') {
        const decoded = Buffer.from(text, 'base64').toString('utf-8');
        if (!decoded || decoded.length === 0) {
          return extra.reply('❌ Invalid Base64 string.');
        }
        result = decoded;
        label = 'DECODED';
      } else {
        return extra.reply('❌ Use "encode" or "decode" as the first argument.');
      }

      const reply = `╭━━〔 🔐 BASE64 ${label} 〕━━⬣
┃ 📥 *Input:* ${text.length > 100 ? text.substring(0, 100) + '...' : text}
┃ 📤 *Output:* ${result.length > 500 ? result.substring(0, 500) + '...' : result}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
