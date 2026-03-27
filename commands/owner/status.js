const os = require('os');

module.exports = {
  name: 'status',
  aliases: ['botstatus', 'stats'],
  category: 'owner',
  description: 'Show detailed bot status information',
  usage: '.status',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const formatBytes = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
      };

      let text = `📊 *BOT STATUS*\n\n`;
      text += `╭───〔 ⏱ Uptime 〕───\n`;
      text += `│ ${hours}h ${minutes}m ${seconds}s\n`;
      text += `╰────────────────────\n\n`;

      text += `╭───〔 💾 Memory 〕───\n`;
      text += `│ RSS: ${formatBytes(memUsage.rss)}\n`;
      text += `│ Heap Used: ${formatBytes(memUsage.heapUsed)}\n`;
      text += `│ Heap Total: ${formatBytes(memUsage.heapTotal)}\n`;
      text += `╰────────────────────\n\n`;

      text += `╭───〔 🖥 System 〕───\n`;
      text += `│ Platform: ${os.platform()}\n`;
      text += `│ Arch: ${os.arch()}\n`;
      text += `│ CPUs: ${os.cpus().length}\n`;
      text += `│ Total RAM: ${formatBytes(totalMem)}\n`;
      text += `│ Used RAM: ${formatBytes(usedMem)}\n`;
      text += `│ Free RAM: ${formatBytes(freeMem)}\n`;
      text += `╰────────────────────\n\n`;

      text += `╭───〔 📦 Node.js 〕───\n`;
      text += `│ Version: ${process.version}\n`;
      text += `│ PID: ${process.pid}\n`;
      text += `╰────────────────────`;

      await extra.reply(text);
    } catch (error) {
      console.error('Status command error:', error);
      await extra.reply('❌ Error fetching bot status.');
    }
  }
};
