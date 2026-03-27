const config = require('../../config');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

module.exports = {
  name: 'testping',
  aliases: ['tping', 'bottest', 'serverping'],
  category: 'general',
  description: 'Test bot response time and server health',
  usage: '.testping',

  async execute(sock, msg, args, extra) {
    try {
      const start = Date.now();
      await extra.react('⏳');

      const uptime = process.uptime();
      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      const mem = process.memoryUsage();
      const ramMB = (mem.rss / 1024 / 1024).toFixed(1);
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const ping = Date.now() - start;

      const barLen = 10;
      const ramFilled = Math.min(Math.round((parseFloat(ramMB) / 512) * barLen), barLen);
      const ramBar = '█'.repeat(ramFilled) + '░'.repeat(barLen - ramFilled);

      const pingEmoji = ping < 100 ? '🟢' : ping < 300 ? '🟡' : '🔴';
      const pingStatus = ping < 100 ? 'Excellent' : ping < 300 ? 'Good' : 'Slow';
      const speedBar = ping < 50 ? '██████████' : ping < 100 ? '████████░░' : ping < 200 ? '██████░░░░' : '████░░░░░░';

      const text =
        `╭━━〔 🏓 *TEST PING* 〕━━⬣\n` +
        `┃\n` +
        `┃  ${pingEmoji} *Ping:* ${ping}ms — *${pingStatus}*\n` +
        `┃  ⚡ Speed: [${speedBar}]\n` +
        `┃\n` +
        `┃  ⏰ *Uptime:* ${h}h ${m}m ${s}s\n` +
        `┃  💾 *RAM:* ${ramMB} MB [${ramBar}]\n` +
        `┃  🧠 *Heap:* ${heapMB} MB\n` +
        `┃  🖥 *Node:* ${process.version}\n` +
        `┃  ✅ *Status:* Online & Ready\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

      await extra.react('🏓');

      await sendBtn(sock, extra.from, {
        text,
        footer: `♾️ ${config.botName} • Tap a button below`,
        buttons: [
          btn('testping', '🔄 Ping Again'),
          btn('cmd_menu', '📋 Main Menu'),
          btn('cmd_alive', '🤖 Bot Status'),
          urlBtn('🌐 Website', CHANNEL_URL),
        ]
      }, { quoted: msg });

    } catch (error) {
      // Fallback to plain text if buttons fail
      try {
        const ping = Date.now() - Date.now();
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
        const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        await extra.reply(`🏓 *Pong!*\n⏰ Uptime: ${h}h ${m}m ${s}s\n💾 RAM: ${ram} MB\n✅ Status: Online`);
      } catch {}
    }
  }
};
