const config = require('../../config');

module.exports = {
  name: 'rules',
  aliases: ['botrules', 'rule'],
  category: 'general',
  description: 'Show bot/group rules',
  usage: '.rules',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';

      let text = `╭━━〔 📜 ${botName} RULES 〕━━╮\n`;
      text += `┃\n`;
      text += `┃ 1️⃣ Do not spam commands\n`;
      text += `┃ 2️⃣ Do not abuse the bot\n`;
      text += `┃ 3️⃣ Do not use bot for illegal activities\n`;
      text += `┃ 4️⃣ Respect other users\n`;
      text += `┃ 5️⃣ Do not flood the group\n`;
      text += `┃ 6️⃣ Follow group admin instructions\n`;
      text += `┃ 7️⃣ Do not share NSFW in non-NSFW groups\n`;
      text += `┃ 8️⃣ Use commands in the correct format\n`;
      text += `┃ 9️⃣ Report bugs to the owner\n`;
      text += `┃ 🔟 Have fun and be respectful!\n`;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> Breaking rules may result in a ban from using the bot.`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
