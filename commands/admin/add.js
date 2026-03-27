module.exports = {
  name: 'add',
  aliases: ['addmember'],
  category: 'admin',
  description: 'Add member to group',
  usage: '.add 94771234567',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) {
        return extra.reply('❌ Please provide a phone number!\n\nExample: .add 94771234567');
      }

      let number = args[0].replace(/[^0-9]/g, '');
      if (!number) {
        return extra.reply('❌ Invalid phone number!');
      }

      const jid = number + '@s.whatsapp.net';

      const result = await sock.groupParticipantsUpdate(extra.from, [jid], 'add');

      if (result && result[0]) {
        const status = result[0].status || result[0].content?.toString();
        if (status === '403') {
          await extra.reply('❌ Cannot add this user. They may have privacy settings enabled.\n\nAn invite link has been sent instead.');
        } else if (status === '409') {
          await extra.reply('❌ User is already in the group!');
        } else if (status === '408') {
          await extra.reply('❌ Cannot add this user. They recently left the group.');
        } else {
          await extra.reply(`✅ @${number} has been added to the group!`);
        }
      } else {
        await extra.reply(`✅ @${number} has been added to the group!`);
      }

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
