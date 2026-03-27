module.exports = {
  name: 'speed',
  aliases: ['speedtest', 'sp'],
  category: 'general',
  description: 'Test bot response speed',
  usage: '.speed',

  async execute(sock, msg, args, extra) {
    try {
      const start = Date.now();
      await extra.react('⚡');

      const timestamps = [];
      for (let i = 0; i < 5; i++) {
        const t1 = Date.now();
        JSON.stringify({ test: 'data'.repeat(100) });
        JSON.parse(JSON.stringify({ nested: { data: Array(50).fill('test') } }));
        timestamps.push(Date.now() - t1);
      }

      const end = Date.now();
      const responseTime = end - start;
      const avgProcess = (timestamps.reduce((a, b) => a + b, 0) / timestamps.length).toFixed(2);

      const ramUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      const heapUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      let rating;
      if (responseTime < 200) rating = '🟢 Excellent';
      else if (responseTime < 500) rating = '🟡 Good';
      else if (responseTime < 1000) rating = '🟠 Average';
      else rating = '🔴 Slow';

      let text = `╭━━〔 ⚡ SPEED TEST 〕━━╮\n`;
      text += `┃ 🏓 *Response* : ${responseTime}ms\n`;
      text += `┃ ⚙️ *Processing* : ${avgProcess}ms avg\n`;
      text += `┃ 💾 *RAM Usage* : ${ramUsed} MB\n`;
      text += `┃ 📦 *Heap Used* : ${heapUsed} MB\n`;
      text += `┃ 📊 *Rating* : ${rating}\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
