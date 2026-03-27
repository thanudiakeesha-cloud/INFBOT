module.exports = {
  name: 'setdesc',
  aliases: ['setdescription', 'setgroupdesc'],
  category: 'admin',
  description: 'Set group description',
  usage: '.setdesc <new description>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const desc = args.join(' ');
      if (!desc) {
        return extra.reply('❌ Please provide a new description!\n\nExample: .setdesc Welcome to our group!');
      }

      await sock.groupUpdateDescription(extra.from, desc);
      await extra.reply('✅ Group description updated successfully!');

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
