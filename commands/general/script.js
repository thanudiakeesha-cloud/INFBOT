const config = require('../../config');

module.exports = {
  name: 'script',
  aliases: ['sc', 'botscript'],
  category: 'general',
  description: 'Show bot script information',
  usage: '.script',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';
      const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : (config.ownerName || 'Infinity Team');
      const github = config.social?.github || 'Not provided';

      let text = `╭━━〔 📜 BOT SCRIPT 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ 🤖 *Name* : ${botName}\n`;
      text += `┃ 👑 *Dev* : ${ownerName}\n`;
      text += `┃ 🏷 *Version* : v2.0.0\n`;
      text += `┃ 📦 *Library* : @whiskeysockets/baileys\n`;
      text += `┃ 🟩 *Runtime* : Node.js ${process.version}\n`;
      text += `┃ 🗄 *Database* : PostgreSQL\n`;
      text += `┃ 🌐 *GitHub* : ${github}\n`;
      text += `┃ 📋 *License* : MIT\n`;
      text += `┃\n`;
      text += `┃ 💡 *Features:*\n`;
      text += `┃ • Multi-device support\n`;
      text += `┃ • Auto-update system\n`;
      text += `┃ • Plugin-based commands\n`;
      text += `┃ • Group management\n`;
      text += `┃ • Media downloader\n`;
      text += `┃ • AI integration\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> *${botName}* - Free & Open Source`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
