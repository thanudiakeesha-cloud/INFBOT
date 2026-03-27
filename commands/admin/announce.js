module.exports = {
  name: 'announce',
  aliases: ['announcement'],
  category: 'admin',
  description: 'Send an announcement to the group',
  usage: '.announce <message>',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const text = args.join(' ');
      if (!text) {
        return extra.reply('❌ Please provide an announcement message!\n\nExample: .announce Meeting at 5pm today!');
      }

      const metadata = await sock.groupMetadata(extra.from);
      const allMembers = metadata.participants.map(p => p.id);

      const announcement = `📢 *ANNOUNCEMENT*\n\n${text}\n\n_Sent by admin_`;

      await sock.sendMessage(extra.from, {
        text: announcement,
        mentions: allMembers
      });

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
