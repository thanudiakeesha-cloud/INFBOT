module.exports = {
  name: 'countdown',
  aliases: ['cd', 'timeleft', 'daysleft'],
  category: 'utility',
  description: 'Calculate countdown to a specific date',
  usage: '.countdown <date>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .countdown <date>\n\nExamples:\n.countdown 2025-12-25\n.countdown December 25, 2025\n.countdown 2025-01-01');
      }

      const targetDate = new Date(args.join(' '));
      if (isNaN(targetDate.getTime())) {
        return extra.reply('❌ Invalid date format! Try:\n.countdown 2025-12-25\n.countdown December 25, 2025');
      }

      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      const isPast = diff < 0;
      const absDiff = Math.abs(diff);

      const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

      const totalHours = Math.floor(absDiff / (1000 * 60 * 60));
      const totalMinutes = Math.floor(absDiff / (1000 * 60));
      const weeks = Math.floor(days / 7);

      const reply = `╭━━〔 ⏳ COUNTDOWN 〕━━⬣
┃ 📅 *Target:* ${targetDate.toDateString()}
┃ ${isPast ? '⏮️ *Status:* Date has passed' : '⏭️ *Status:* Upcoming'}
┃ 
┃ ⏱️ *${isPast ? 'Time since' : 'Time left'}:*
┃ 📆 ${days} days, ${hours}h ${minutes}m ${seconds}s
┃ 📊 (~${weeks} weeks / ${totalHours.toLocaleString()} hours)
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
