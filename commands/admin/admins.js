module.exports = {
  name: 'admins',
  aliases: ['listadmins', 'adminlist'],
  category: 'admin',
  description: 'List all group admins',
  usage: '.admins',
  groupOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const metadata = await sock.groupMetadata(extra.from);
      const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

      if (admins.length === 0) {
        return extra.reply('❌ No admins found!');
      }

      let text = `👑 *Group Admins* (${admins.length})\n\n`;

      admins.forEach((admin, i) => {
        const role = admin.admin === 'superadmin' ? '👑 Creator' : '⭐ Admin';
        text += `${i + 1}. @${admin.id.split('@')[0]} - ${role}\n`;
      });

      await sock.sendMessage(extra.from, {
        text,
        mentions: admins.map(a => a.id)
      }, { quoted: msg });

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
