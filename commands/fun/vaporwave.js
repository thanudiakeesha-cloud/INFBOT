module.exports = {
  name: 'vaporwave',
  aliases: ['aesthetic', 'vapor', 'wide'],
  category: 'fun',
  description: 'Convert text to ａｅｓｔｈｅｔｉｃ vaporwave text',
  usage: '.vaporwave <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .vaporwave <text>\n\nExample: .vaporwave Hello World');
      }

      const text = args.join(' ');
      const vaporwaved = text.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) {
          return String.fromCharCode(code + 65248);
        } else if (c === ' ') {
          return '　';
        }
        return c;
      }).join('');

      await extra.react('✨');

      const result = `╭━━〔 ✨ ＡＥＳＴＨＥＴＩＣ 〕━━⬣
┃
┃ ${vaporwaved}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
