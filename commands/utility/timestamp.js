module.exports = {
  name: 'timestamp',
  aliases: ['time', 'date', 'now', 'ts'],
  category: 'utility',
  description: 'Show current timestamp or convert dates',
  usage: '.timestamp [unix timestamp]',

  async execute(sock, msg, args, extra) {
    try {
      let date;
      let label;

      if (args.length > 0) {
        const input = args[0];
        const ts = parseInt(input);
        if (!isNaN(ts)) {
          date = ts > 9999999999 ? new Date(ts) : new Date(ts * 1000);
          label = 'TIMESTAMP CONVERSION';
        } else {
          date = new Date(args.join(' '));
          if (isNaN(date.getTime())) {
            return extra.reply('❌ Invalid date or timestamp!\n\nUsage:\n.timestamp - Current time\n.timestamp 1704067200 - Unix timestamp\n.timestamp 2024-01-01 - Date string');
          }
          label = 'DATE CONVERSION';
        }
      } else {
        date = new Date();
        label = 'CURRENT TIME';
      }

      const unixSec = Math.floor(date.getTime() / 1000);
      const unixMs = date.getTime();

      const reply = `╭━━〔 🕐 ${label} 〕━━⬣
┃ 📅 *Date:* ${date.toDateString()}
┃ 🕐 *Time:* ${date.toTimeString().split(' ')[0]}
┃ 🌍 *UTC:* ${date.toUTCString()}
┃ 📋 *ISO:* ${date.toISOString()}
┃ 🔢 *Unix (sec):* ${unixSec}
┃ 🔢 *Unix (ms):* ${unixMs}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
