module.exports = {
  name: 'clearall',
  aliases: ['clearchats', 'clearchat'],
  category: 'owner',
  description: 'Clear all chats',
  usage: '.clearall',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      await extra.reply('🗑️ Clearing all chats...');

      const chats = await sock.groupFetchAllParticipating();
      const chatIds = Object.keys(chats);

      let cleared = 0;
      for (const chatId of chatIds) {
        try {
          await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, chatId);
          cleared++;
        } catch (e) {
        }
      }

      await extra.reply(`✅ Attempted to clear *${cleared}* chats.`);
    } catch (error) {
      console.error('Clearall command error:', error);
      await extra.reply('❌ Error clearing chats.');
    }
  }
};
