const config = require('../../config');

module.exports = {
  name: 'creator',
  aliases: ['dev', 'developer'],
  category: 'general',
  description: 'Show creator/developer contact information',
  usage: '.creator',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';
      const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : (config.ownerName || 'Infinity Team');
      const ownerNumber = Array.isArray(config.ownerNumber) ? config.ownerNumber[0] : (config.ownerNumber || '');

      let text = `╭━━〔 👨‍💻 CREATOR 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ 🤖 *Bot* : ${botName}\n`;
      text += `┃ 👑 *Creator* : ${ownerName}\n`;
      if (ownerNumber) {
        text += `┃ 📱 *Contact* : wa.me/${ownerNumber}\n`;
      }
      text += `┃ 🏷 *Version* : v2.0.0\n`;
      text += `┃\n`;
      text += `┃ Created with ❤️ by ${ownerName}\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯`;

      if (ownerNumber) {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\nEND:VCARD`;
        await sock.sendMessage(extra.from, {
          contacts: {
            displayName: ownerName,
            contacts: [{ vcard }]
          }
        }, { quoted: msg });
      }

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
