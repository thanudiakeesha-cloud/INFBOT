module.exports = {
  name: 'chatlist',
  aliases: ['chats', 'listchats', 'grouplist'],
  category: 'owner',
  description: 'List all active chats/groups',
  usage: '.chatlist [groups/private]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);

      const filter = args[0]?.toLowerCase();

      if (filter === 'groups' || !filter) {
        let text = `📋 *GROUP CHATS* (${groupIds.length})\n\n`;

        if (groupIds.length === 0) {
          text += 'No groups found.';
        } else {
          let count = 0;
          for (const id of groupIds) {
            count++;
            const group = groups[id];
            const name = group.subject || 'Unknown';
            const members = group.participants?.length || 0;
            text += `${count}. ${name}\n`;
            text += `   👥 ${members} members\n`;
            text += `   🆔 ${id}\n\n`;

            if (count >= 50) {
              text += `... and ${groupIds.length - 50} more groups`;
              break;
            }
          }
        }

        await extra.reply(text);
      } else {
        await extra.reply('❌ Invalid filter! Use: .chatlist [groups]');
      }
    } catch (error) {
      console.error('Chatlist command error:', error);
      await extra.reply('❌ Error fetching chat list.');
    }
  }
};
