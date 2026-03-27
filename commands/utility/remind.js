const reminders = new Map();

module.exports = {
  name: 'remind',
  aliases: ['reminder', 'remindme', 'alarm'],
  category: 'utility',
  description: 'Set a reminder that pings you after a delay',
  usage: '.remind <time> <message>\nTime format: 5s, 10m, 1h',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage: .remind <time> <message>\n\nExamples:\n.remind 5m Take a break\n.remind 1h Call mom\n.remind 30s Check oven\n\nTime units: s (seconds), m (minutes), h (hours)');
      }

      const timeStr = args[0].toLowerCase();
      const message = args.slice(1).join(' ');

      const match = timeStr.match(/^(\d+)(s|m|h)$/);
      if (!match) {
        return extra.reply('❌ Invalid time format. Use: 5s, 10m, 1h');
      }

      const value = parseInt(match[1]);
      const unit = match[2];

      let ms;
      let unitLabel;
      switch (unit) {
        case 's': ms = value * 1000; unitLabel = 'second(s)'; break;
        case 'm': ms = value * 60000; unitLabel = 'minute(s)'; break;
        case 'h': ms = value * 3600000; unitLabel = 'hour(s)'; break;
      }

      if (ms > 86400000) {
        return extra.reply('❌ Maximum reminder time is 24 hours.');
      }

      if (ms < 5000) {
        return extra.reply('❌ Minimum reminder time is 5 seconds.');
      }

      await extra.react('⏰');

      const timerId = setTimeout(async () => {
        try {
          const mentions = [extra.sender];
          await sock.sendMessage(extra.from, {
            text: `⏰ *REMINDER*\n\n@${extra.sender.split('@')[0]}, you asked me to remind you:\n\n📝 *${message}*\n\n> *INFINITY MD*`,
            mentions
          });
        } catch (e) {}
        reminders.delete(timerId);
      }, ms);

      reminders.set(timerId, { sender: extra.sender, message, ms });

      await extra.reply(`✅ Reminder set! I'll remind you in *${value} ${unitLabel}*.\n\n📝 "${message}"`);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
