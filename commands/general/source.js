const config = require('../../config');

module.exports = {
  name: 'source',
  aliases: ['src', 'repo', 'sourcecode'],
  category: 'general',
  description: 'Show bot source code information',
  usage: '.source',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';
      const github = config.social?.github || 'Not provided';

      let text = `╭━━〔 📂 SOURCE CODE 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ 🤖 *Bot* : ${botName}\n`;
      text += `┃ 🏷 *Version* : v2.0.0\n`;
      text += `┃ 📦 *Library* : Baileys\n`;
      text += `┃ 🟩 *Runtime* : Node.js\n`;
      text += `┃ 🗄 *Database* : PostgreSQL\n`;
      text += `┃ 🌐 *GitHub* : ${github}\n`;
      text += `┃\n`;
      text += `┃ This bot is an open-source\n`;
      text += `┃ WhatsApp bot built with Baileys.\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> *${botName}* - Made with ❤️`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
