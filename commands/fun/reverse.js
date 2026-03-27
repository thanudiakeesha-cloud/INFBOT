module.exports = {
  name: 'reverse',
  aliases: ['rev', 'backwards'],
  category: 'fun',
  description: 'Reverse text',
  usage: '.reverse <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .reverse <text>\n\nExample: .reverse Hello World');
      }

      const text = args.join(' ');
      const reversed = text.split('').reverse().join('');

      await extra.react('🔄');

      const result = `╭━━〔 🔄 REVERSE TEXT 〕━━⬣
┃
┃ 📝 *Original:* ${text}
┃
┃ 🔀 *Reversed:* ${reversed}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
