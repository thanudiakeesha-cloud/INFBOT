module.exports = {
  name: 'ephemeral',
  aliases: ['disappearing', 'disappear'],
  category: 'admin',
  description: 'Set disappearing messages timer',
  usage: '.ephemeral <off|24h|7d|90d>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const option = (args[0] || '').toLowerCase();

      const durations = {
        'off': 0,
        '0': 0,
        '24h': 86400,
        '1d': 86400,
        '7d': 604800,
        '1w': 604800,
        '90d': 7776000,
        '3m': 7776000
      };

      if (!option || !(option in durations)) {
        return extra.reply('❌ Please specify a duration!\n\nOptions:\n• .ephemeral off - Disable\n• .ephemeral 24h - 24 hours\n• .ephemeral 7d - 7 days\n• .ephemeral 90d - 90 days');
      }

      const seconds = durations[option];
      await sock.sendMessage(extra.from, { disappearingMessagesInChat: seconds });

      const labels = {
        0: 'disabled',
        86400: '24 hours',
        604800: '7 days',
        7776000: '90 days'
      };

      if (seconds === 0) {
        await extra.reply('✅ Disappearing messages have been disabled!');
      } else {
        await extra.reply(`✅ Disappearing messages set to ${labels[seconds]}!`);
      }

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
