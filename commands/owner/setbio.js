module.exports = {
  name: 'setbio',
  aliases: ['setabout', 'bio'],
  category: 'owner',
  description: 'Set bot bio/about text',
  usage: '.setbio <text>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      if (!args.length) {
        return extra.reply('❌ Please provide bio text!\nUsage: .setbio <text>');
      }

      const bioText = args.join(' ');

      if (bioText.length > 139) {
        return extra.reply('❌ Bio text is too long! Maximum 139 characters.');
      }

      await sock.updateProfileStatus(bioText);
      await extra.reply(`✅ Bot bio updated to:\n\n"${bioText}"`);
    } catch (error) {
      console.error('Setbio command error:', error);
      await extra.reply('❌ Error setting bot bio.');
    }
  }
};
