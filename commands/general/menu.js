const config  = require('../../config');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');
const { getLang, t, LANGUAGES } = require('../../utils/lang');

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ramBar(usedMB, totalMB) {
  const pct    = Math.min(100, Math.round((usedMB / totalMB) * 100));
  const filled = Math.round(pct / 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${bar} ${pct}%`;
}

function pickMenuImage() {
  const bannersDir = path.join(__dirname, '../../utils/banners');
  const fallback   = path.join(__dirname, '../../utils/bot_image.jpg');
  try {
    if (fs.existsSync(bannersDir)) {
      const files = fs.readdirSync(bannersDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (files.length) return path.join(bannersDir, files[Math.floor(Math.random() * files.length)]);
    }
  } catch (_) {}
  return fs.existsSync(fallback) ? fallback : null;
}

const CATEGORIES = {
  media: {
    icon: '📥', label: 'Media & Download',
    cmds: [
      { name: 'film',   desc: 'SinhalaSub.lk movies 🎬' },
      { name: 'film3',  desc: 'Cinesubz.com movies 🎞️' },
      { name: 'song',   desc: 'Download songs 🎵' },
      { name: 'yt',     desc: 'YouTube info & search 🔍' },
      { name: 'ytmp3',  desc: 'YouTube → MP3 🎧' },
      { name: 'ytmp4',  desc: 'YouTube → MP4 📹' },
      { name: 'play',   desc: 'Play & send audio ▶️' },
      { name: 'tiktok', desc: 'TikTok downloader 🎵' },
      { name: 'lyrics', desc: 'Search song lyrics 🎤' },
    ],
  },
  admin: {
    icon: '🛡️', label: 'Group Admin',
    cmds: [
      { name: 'antilink',  desc: 'Block group invite links 🔗' },
      { name: 'tagall',    desc: 'Tag all members 📢' },
      { name: 'hidetag',   desc: 'Silent tag everyone 🔕' },
      { name: 'kick',      desc: 'Remove a member 🦶' },
      { name: 'promote',   desc: 'Promote to admin ⬆️' },
      { name: 'demote',    desc: 'Remove admin role ⬇️' },
      { name: 'mute',      desc: 'Mute the group 🔇' },
      { name: 'unmute',    desc: 'Unmute the group 🔊' },
      { name: 'lock',      desc: 'Lock group settings 🔒' },
      { name: 'unlock',    desc: 'Unlock group settings 🔓' },
      { name: 'welcome',   desc: 'Welcome new members 👋' },
      { name: 'goodbye',   desc: 'Farewell message 🚪' },
      { name: 'members',   desc: 'List all members 👥' },
      { name: 'setname',   desc: 'Change group name ✏️' },
      { name: 'warn',      desc: 'Issue a warning ⚠️' },
    ],
  },
  owner: {
    icon: '👑', label: 'Owner Only',
    cmds: [
      { name: 'mode',         desc: 'Public / private mode 🔀' },
      { name: 'settings',     desc: 'Bot settings panel ⚙️' },
      { name: 'broadcast',    desc: 'Broadcast to all chats 📡' },
      { name: 'block',        desc: 'Block a user 🚫' },
      { name: 'unblock',      desc: 'Unblock a user ✅' },
      { name: 'join',         desc: 'Join a group by link 🔗' },
      { name: 'leave',        desc: 'Leave a group 🚶' },
      { name: 'anticall',     desc: 'Auto-reject calls 📵' },
      { name: 'antidelete',   desc: 'Recover deleted msgs 🗑️' },
      { name: 'antiviewonce', desc: 'Save view-once media 👁️' },
      { name: 'autoreact',    desc: 'Auto-react to msgs 😊' },
      { name: 'autoreply',    desc: 'Auto-reply to msgs 💬' },
      { name: 'autostatus',   desc: 'Auto-view statuses 👀' },
    ],
  },
  tools: {
    icon: '🛠️', label: 'Tools & AI',
    cmds: [
      { name: 'ai',        desc: 'Ask AI anything 🤖' },
      { name: 'gpt',       desc: 'ChatGPT responses 💡' },
      { name: 'calc',      desc: 'Calculator 🔢' },
      { name: 'translate', desc: 'Translate text 🌍' },
      { name: 'weather',   desc: 'Weather forecast ☀️' },
      { name: 'wiki',      desc: 'Wikipedia search 📚' },
      { name: 'sticker',   desc: 'Image → sticker 🖼️' },
      { name: 'togif',     desc: 'Video → GIF 🎞️' },
      { name: 'toimg',     desc: 'Sticker → image 🖼️' },
      { name: 'tomp3',     desc: 'Video → MP3 🎵' },
    ],
  },
  fun: {
    icon: '🎮', label: 'Fun & General',
    cmds: [
      { name: 'fact',    desc: 'Random interesting fact 💡' },
      { name: 'joke',    desc: 'Tell a random joke 😂' },
      { name: 'meme',    desc: 'Send a random meme 🤣' },
      { name: 'alive',   desc: 'Check bot is alive 💚' },
      { name: 'ping',    desc: 'Bot response speed ⚡' },
      { name: 'owner',   desc: 'Contact the owner 👤' },
      { name: 'runtime', desc: 'Bot uptime info ⏱️' },
      { name: 'lang',    desc: 'Change bot language 🌐' },
      { name: 'save',    desc: 'Save a message 💾' },
    ],
  },
};

const ALIAS_MAP = {
  mediamenu: 'media', dlmenu: 'media', downloadmenu: 'media',
  adminmenu: 'admin',
  ownermenu: 'owner',
  toolsmenu: 'tools', toolmenu: 'tools', utilitymenu: 'tools', aimenu: 'tools', convertermenu: 'tools',
  funmenu: 'fun', generalmenu: 'fun',
};

const MAIN_BUTTONS = [
  btn('mediamenu', '📥 Media'),
  btn('adminmenu', '🛡️ Admin'),
  btn('ownermenu', '👑 Owner'),
  btn('toolsmenu', '🛠️ Tools'),
  btn('funmenu',   '🎮 Fun'),
];

function buildMainMenu({ botName, ownerName, senderNum, uptimeStr, ramMB, prefix }) {
  const totalCmds = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
  const totalMB   = Math.round(os.totalmem() / 1024 / 1024);
  const bar       = ramBar(Number(ramMB), totalMB);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening';

  let tx = '';
  tx += `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
  tx += `┃  ♾️  *${botName}*\n`;
  tx += `┃  _WhatsApp Multi-Bot Manager_\n`;
  tx += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  tx += `${greeting}, @${senderNum}! 👋\n\n`;

  tx += `┌───── 📊 *BOT STATUS* ─────\n`;
  tx += `│ 👑 *Owner  :* ${ownerName}\n`;
  tx += `│ ⌨️  *Prefix :* \`${prefix}\`\n`;
  tx += `│ ⏱️  *Uptime :* ${uptimeStr}\n`;
  tx += `│ 💾 *RAM    :* ${bar}\n`;
  tx += `│ 📦 *Total  :* ${totalCmds} commands\n`;
  tx += `└───────────────────────────\n\n`;

  tx += `┌────── 📋 *CATEGORIES* ─────\n`;
  for (const [, cat] of Object.entries(CATEGORIES)) {
    const n    = cat.cmds.length;
    const dots = '●'.repeat(Math.min(n, 10)) + '○'.repeat(Math.max(0, 10 - n));
    tx += `│\n`;
    tx += `│  ${cat.icon}  *${cat.label}*\n`;
    tx += `│     ${dots}  ${n} cmds\n`;
  }
  tx += `└───────────────────────────\n\n`;
  tx += `> 💡 _Tap a button below to view commands_\n`;
  tx += `> 🔖 _Type_ \`${prefix}<command>\` _for usage help_`;

  return tx;
}

function buildSubmenu(catKey, prefix) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  let tx = `┏━━━━━━━━━━━━━━━━━━━━┓\n`;
  tx += `┃  ${cat.icon}  *${cat.label}*\n`;
  tx += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;

  cat.cmds.forEach((cmd, i) => {
    const num = String(i + 1).padStart(2, '0');
    tx += `│ *${num}.* \`${prefix}${cmd.name}\`\n`;
    tx += `│      ╰ ${cmd.desc}\n`;
  });

  tx += `\n> 📌 _${cat.cmds.length} commands available_\n`;
  tx += `> 💬 _Send any command to get usage details_`;

  return tx;
}

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'mediamenu', 'dlmenu', 'downloadmenu',
    'adminmenu',
    'ownermenu',
    'aimenu',
    'toolmenu', 'toolsmenu', 'utilitymenu',
    'convertermenu',
    'funmenu', 'generalmenu',
  ],
  category: 'general',
  description: 'Show all bot commands and submenus',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId    = extra?.from || msg?.key?.remoteJid;
    const sender    = extra?.sender || msg?.key?.participant || chatId;
    const prefix    = sock?._customConfig?.settings?.prefix || config.prefix || '.';
    const botName   = sock?._customConfig?.botName || String(config.botName || 'Infinity MD Mini');
    const ownerName = sock?._customConfig?.ownerName
                      || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName)
                      || 'Owner';

    const lang      = getLang(chatId);
    const senderNum = String(sender).split('@')[0] || '';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB     = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);

    const imgPath = pickMenuImage();
    const image   = imgPath ? { url: imgPath } : undefined;

    const usedCmd = String(extra?.commandName || '').toLowerCase().replace(prefix, '');
    const subArg  = args[0] ? String(args[0]).toLowerCase() : null;

    const submenuKey =
      ALIAS_MAP[usedCmd]  ||
      ALIAS_MAP[subArg]   ||
      (CATEGORIES[usedCmd] ? usedCmd : null) ||
      (CATEGORIES[subArg]  ? subArg  : null);

    if (submenuKey) {
      const cat  = CATEGORIES[submenuKey];
      const text = buildSubmenu(submenuKey, prefix);
      if (!text) return sock.sendMessage(chatId, { text: '❌ Unknown menu section.' }, { quoted: msg });

      return sendBtn(sock, chatId, {
        text,
        footer: `${cat.icon} ${cat.label} · ${cat.cmds.length} commands`,
        ...(image ? { image } : {}),
        buttons: [
          btn('menu', '🏠 Main Menu'),
          urlBtn('💬 Support', 'https://wa.me/94770612011'),
        ],
      }, { quoted: msg });
    }

    const totalCmds = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
    const text = buildMainMenu({ botName, ownerName, senderNum, uptimeStr, ramMB, prefix, lang });

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName} · ${totalCmds} commands ready`,
      ...(image ? { image } : {}),
      buttons: MAIN_BUTTONS,
      mentions: [sender],
    }, { quoted: msg });
  },
};
