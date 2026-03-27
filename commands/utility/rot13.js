module.exports = {
  name: 'rot13',
  aliases: ['rot', 'cipher13'],
  category: 'utility',
  description: 'Apply ROT13 cipher to text (encode and decode are the same)',
  usage: '.rot13 <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .rot13 <text>\n\nExample: .rot13 Hello World');
      }

      const text = args.join(' ');
      const result = text.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });

      const reply = `╭━━〔 🔄 ROT13 CIPHER 〕━━⬣
┃ 📥 *Input:* ${text}
┃ 📤 *Output:* ${result}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
