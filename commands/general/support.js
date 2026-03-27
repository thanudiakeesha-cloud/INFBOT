const config = require('../../config');

module.exports = {
  name: 'support',
  aliases: ['supportgroup', 'group'],
  category: 'general',
  description: 'Show support group link',
  usage: '.support',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';

      let text = `╭━━〔 💬 SUPPORT 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ Need help with *${botName}*?\n`;
      text += `┃\n`;
      text += `┃ 📞 *Contact Owner*\n`;
      text += `┃ Use .owner to get owner contact\n`;
      text += `┃\n`;
      text += `┃ 📝 *Report Bugs*\n`;
      text += `┃ Use .report <issue> to report\n`;
      text += `┃\n`;
      text += `┃ 📖 *Commands Help*\n`;
      text += `┃ Use .menu to see all commands\n`;
      text += `┃ Use .help <command> for details\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> *${botName}* Support`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
