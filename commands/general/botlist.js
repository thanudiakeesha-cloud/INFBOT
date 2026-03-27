const config = require('../../config');

module.exports = {
  name: 'botlist',
  aliases: ['bots', 'listbot'],
  category: 'general',
  description: 'List active bots in the group',
  usage: '.botlist',

  async execute(sock, msg, args, extra) {
    try {
      const chatId = extra.from;
      const isGroup = chatId.endsWith('@g.us');

      if (!isGroup) {
        const botName = config.botName || 'Infinity MD';
        let text = `╭━━〔 🤖 BOT LIST 〕━━╮\n`;
        text += `┃\n`;
        text += `┃ 🤖 *${botName}* - Active ✅\n`;
        text += `┃ 🏷 Version: v2.0.0\n`;
        text += `┃\n`;
        text += `╰━━━━━━━━━━━━━━━━━━━━╯`;
        return await extra.reply(text);
      }

      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];
      const botJid = sock.user?.id;
      const botNumber = botJid ? botJid.split(':')[0].split('@')[0] : '';

      let botCount = 0;
      let botLines = '';

      for (const p of participants) {
        const num = p.id.split('@')[0];
        if (num === botNumber) {
          botCount++;
          const botName = config.botName || 'Infinity MD';
          botLines += `┃ 🤖 *${botName}* (@${num}) ✅\n`;
        }
      }

      if (botCount === 0) {
        botLines = `┃ No bots detected\n`;
      }

      let text = `╭━━〔 🤖 BOT LIST 〕━━╮\n`;
      text += `┃ 📊 *Group* : ${metadata.subject}\n`;
      text += `┃ 🤖 *Bots* : ${botCount}\n`;
      text += `┃\n`;
      text += botLines;
      text += `┃\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯`;

      await sock.sendMessage(chatId, {
        text,
        mentions: participants.map(p => p.id)
      }, { quoted: msg });
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
