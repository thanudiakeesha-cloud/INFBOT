const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function mentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function mono(txt) {
  return '```' + '\n' + txt + '\n' + '```';
}

function buildSection(title, names, prefix) {
  if (!names.length) return '';
  let s = `┏━━━━━━━━━━━━━━━━━\n┃ ${title}\n┗━━━━━━━━━━━━━━━━━\n`;
  for (const n of names.sort((a,b)=>a.localeCompare(b))) s += `│ ➜ ${prefix}${n}\n`;
  return s + '\n';
}

module.exports = {
  name: 'mainmenu',
  aliases: ['allmenu', 'fullmenu'],
  category: 'general',
  description: 'Full command list',
  usage: '.mainmenu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';

    const commands = loadCommands();
    const cmdList = Array.isArray(commands)
      ? commands
      : (commands instanceof Map ? Array.from(commands.values()) : []);

    const seen = new Set();
    const bucket = {
      general: [], ai: [], admin: [], owner: [], media: [],
      fun: [], utility: [], entertainment: [], textmaker: [], movie: [], other: []
    };

    for (const cmd of cmdList) {
      if (!cmd?.name) continue;
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);

      const cat = String(cmd.category || 'other').toLowerCase().trim();
      if (!bucket[cat]) bucket.other.push(cmd.name);
      else bucket[cat].push(cmd.name);
    }

    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';

    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const who = mentionTag(sender);

    let text =
`╭━━『 ${String(config.botName || 'Infinity MD')} 』━━╮

👋 Hello ${who}!

⚡ Prefix: ${prefix}
📦 Total Commands: ${seen.size}
👑 Owner: ${owner}
⏱ Uptime: ${uptime}
🧠 RAM: ${ram} MB
╰━━━━━━━━━━━━━━━━━

`;

    text += buildSection('🧭 GENERAL COMMAND', bucket.general, prefix);
    text += buildSection('🤖 AI COMMAND', bucket.ai, prefix);
    text += buildSection('🛡️ ADMIN COMMAND', bucket.admin, prefix);
    text += buildSection('👑 OWNER COMMAND', bucket.owner, prefix);
    text += buildSection('🎞️ MEDIA COMMAND', bucket.media, prefix);
    text += buildSection('🎭 FUN COMMAND', bucket.fun, prefix);
    text += buildSection('🔧 UTILITY COMMAND', bucket.utility, prefix);
    text += buildSection('👾 ENTERTAINMENT COMMAND', bucket.entertainment, prefix);
    text += buildSection('🖋️ TEXTMAKER COMMAND', bucket.textmaker, prefix);
    text += buildSection('🎬 MOVIE COMMAND', bucket.movie, prefix);
    if (bucket.other.length) text += buildSection('🧪 OTHER COMMAND', bucket.other, prefix);

    text += `╰━━━━━━━━━━━━━━━━━\n\n💡 Type ${prefix}help <command> for more info`;

    return sock.sendMessage(chatId, { text: mono(text), mentions: [sender] }, { quoted: msg });
  }
};
