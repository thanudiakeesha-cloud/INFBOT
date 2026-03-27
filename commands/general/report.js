const config = require('../../config');

module.exports = {
  name: 'report',
  aliases: ['bug', 'feedback', 'suggest'],
  category: 'general',
  description: 'Send a bug report or suggestion to the bot owner',
  usage: '.report <message>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .report <your message>\n\nExample: .report The sticker command is not working properly');
      }

      const reportMsg = args.join(' ');
      const senderNumber = extra.sender.split('@')[0];
      const timestamp = new Date().toLocaleString('en-US', { timeZone: config.timezone || 'UTC' });

      await extra.react('📨');

      const ownerNumbers = sock._customConfig?.ownerNumber
        ? (Array.isArray(sock._customConfig.ownerNumber) ? sock._customConfig.ownerNumber : [sock._customConfig.ownerNumber])
        : config.ownerNumber;

      const reportText = `╭━━〔 📨 NEW REPORT 〕━━⬣
┃ 👤 *From:* @${senderNumber}
┃ 🕐 *Time:* ${timestamp}
┃ 💬 *Chat:* ${extra.isGroup ? 'Group' : 'Private'}
┃
┃ 📝 *Message:*
┃ ${reportMsg}
╰━━━━━━━━━━━━━━━━━━━━⬣`;

      let sent = false;
      for (const owner of ownerNumbers) {
        try {
          const ownerJid = owner.includes('@') ? owner : `${owner}@s.whatsapp.net`;
          await sock.sendMessage(ownerJid, {
            text: reportText,
            mentions: [extra.sender]
          });
          sent = true;
        } catch (e) {}
      }

      if (sent) {
        await extra.reply('✅ Your report has been sent to the bot owner. Thank you for your feedback!');
      } else {
        await extra.reply('❌ Failed to send report. Please try again later.');
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
