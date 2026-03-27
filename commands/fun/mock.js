module.exports = {
  name: 'mock',
  aliases: ['spongebob', 'mocking'],
  category: 'fun',
  description: 'Convert text to SpOnGeBoB mocking text',
  usage: '.mock <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .mock <text>\n\nExample: .mock I love coding');
      }

      const text = args.join(' ');
      const mocked = text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');

      await extra.react('🧽');

      const result = `╭━━〔 🧽 MOCKING TEXT 〕━━⬣
┃
┃ 📝 *Original:* ${text}
┃
┃ 🤪 *Mocked:* ${mocked}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
