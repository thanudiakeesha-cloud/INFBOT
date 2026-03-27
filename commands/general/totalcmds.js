const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'totalcmds',
  aliases: ['totalcommands', 'cmdcount', 'commandcount'],
  category: 'general',
  description: 'Show total commands count by category',
  usage: '.totalcmds',

  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      const cmdList = commands instanceof Map ? Array.from(commands.values()) : (Array.isArray(commands) ? commands : []);

      const categories = {};
      const seen = new Set();

      for (const cmd of cmdList) {
        if (!cmd?.name || seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        const cat = String(cmd.category || 'other').toLowerCase();
        categories[cat] = (categories[cat] || 0) + 1;
      }

      const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
      const total = seen.size;

      const catEmojis = {
        owner: '👑', admin: '🛡️', media: '📥', fun: '🎮',
        ai: '🤖', utility: '🛠', entertainment: '👾', textmaker: '✍️',
        movie: '🎬', general: '🧭', anime: '🎌', nsfw: '🔞',
        converter: '🔄', game: '🎯', other: '📁'
      };

      let text = `╭━━〔 📊 COMMAND STATS 〕━━╮\n`;
      text += `┃ 📦 *Total Commands* : ${total}\n`;
      text += `┃ 📂 *Categories* : ${sorted.length}\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

      text += `╭━━〔 📂 BY CATEGORY 〕━━╮\n`;
      for (const [cat, count] of sorted) {
        const emoji = catEmojis[cat] || '📁';
        text += `┃ ${emoji} *${cat}* : ${count} commands\n`;
      }
      text += `╰━━━━━━━━━━━━━━━━━━━━╯`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
