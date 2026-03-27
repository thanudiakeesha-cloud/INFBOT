const os = require('os');
const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'info',
  aliases: ['botinfo', 'about'],
  category: 'general',
  description: 'Display bot information card',
  usage: '.info',

  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      const totalCmds = commands instanceof Map ? commands.size : (Array.isArray(commands) ? commands.length : 0);

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const secs = Math.floor(uptime % 60);

      const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      const botName = config.botName || 'Infinity MD';
      const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : (config.ownerName || 'Infinity Team');
      const prefix = config.prefix || '.';

      let text = `╭━━〔 🤖 ${botName} INFO 〕━━╮\n`;
      text += `┃ 📛 *Name* : ${botName}\n`;
      text += `┃ 👑 *Owner* : ${ownerName}\n`;
      text += `┃ ⌨️ *Prefix* : ${prefix}\n`;
      text += `┃ 📊 *Commands* : ${totalCmds}\n`;
      text += `┃ ⏱ *Uptime* : ${hours}h ${minutes}m ${secs}s\n`;
      text += `┃ 💾 *RAM* : ${ramUsage} MB\n`;
      text += `┃ 🖥 *Platform* : ${os.platform()} ${os.arch()}\n`;
      text += `┃ 🟩 *Node* : ${process.version}\n`;
      text += `┃ 🏷 *Version* : v2.0.0\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> *${botName}* - Powered by Baileys`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
