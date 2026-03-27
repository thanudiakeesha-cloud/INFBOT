module.exports = {
  name: 'revoke',
  aliases: ['revokelink', 'resetlink'],
  category: 'admin',
  description: 'Revoke group invite link',
  usage: '.revoke',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      await sock.groupRevokeInvite(extra.from);
      await extra.reply('✅ Group invite link has been revoked!\n\nA new link has been generated.');

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
