const config = require('../../config');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'donate',
  aliases: ['donation', 'support_dev'],
  category: 'general',
  description: 'Show donation information',
  usage: '.donate',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';
      const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : (config.ownerName || 'Infinity Team');

      let text = `╭━━〔 💖 DONATE 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ Thank you for using *${botName}*!\n`;
      text += `┃\n`;
      text += `┃ If you enjoy using this bot and\n`;
      text += `┃ want to support its development,\n`;
      text += `┃ consider making a donation.\n`;
      text += `┃\n`;
      text += `┃ 💰 *Ways to donate:*\n`;
      text += `┃ • Contact the owner directly\n`;
      text += `┃ • Buy Me a Coffee\n`;
      text += `┃\n`;
      text += `┃ 👑 *Owner:* ${ownerName}\n`;
      text += `┃\n`;
      text += `┃ Every contribution helps keep\n`;
      text += `┃ the bot running and improving!\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> *${botName}* appreciates your support! 🙏`;

      const qrPath = path.join(__dirname, '../../utils/bmc_qr.png');
      if (fs.existsSync(qrPath)) {
        await sock.sendMessage(extra.from, {
          image: fs.readFileSync(qrPath),
          caption: text
        }, { quoted: msg });
      } else {
        await extra.reply(text);
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
