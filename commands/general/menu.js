const config  = require('../../config');
const fs      = require('fs');
const path    = require('path');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function pickMenuImage() {
  const bannersDir = path.join(__dirname, '../../utils/banners');
  const fallback   = path.join(__dirname, '../../utils/bot_image.jpg');
  try {
    if (fs.existsSync(bannersDir)) {
      const files = fs.readdirSync(bannersDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (files.length) {
        const chosen = files[Math.floor(Math.random() * files.length)];
        return path.join(bannersDir, chosen);
      }
    }
  } catch (_) {}
  return fs.existsSync(fallback) ? fallback : null;
}

// ─────────────────────────────────────────────
//  COMMAND LABELS  (2–3 words max)
// ─────────────────────────────────────────────
const LABELS = {
  // Media
  song:         'Song download',
  yt:           'YouTube search',
  tiktok:       'TikTok download',
  ytmp3:        'YouTube → MP3',
  ytmp4:        'YouTube → MP4',
  play:         'Quick play',
  lyrics:       'Song lyrics',
  film:         'Movie finder',
  film1:        'SriHub movies',
  // Admin
  antilink:     'Block links',
  demote:       'Remove admin',
  goodbye:      'Leave message',
  hidetag:      'Silent mention',
  kick:         'Kick member',
  lock:         'Lock group',
  members:      'List members',
  mute:         'Mute group',
  promote:      'Make admin',
  setname:      'Rename group',
  tagall:       'Tag everyone',
  unlock:       'Unlock group',
  unmute:       'Unmute group',
  warn:         'Warn member',
  welcome:      'Join message',
  // Owner
  anticall:     'Block calls',
  antidelete:   'Catch deletes',
  antiviewonce: 'Save viewonce',
  autoreact:    'Auto react',
  autoreply:    'Auto reply',
  autostatus:   'Auto status',
  block:        'Block user',
  broadcast:    'Mass message',
  join:         'Join group',
  leave:        'Leave group',
  mode:         'Bot mode',
  settings:     'Bot settings',
  unblock:      'Unblock user',
  // Tools & AI
  ai:           'AI chat',
  gpt:          'GPT chat',
  calc:         'Calculator',
  sticker:      'Make sticker',
  translate:    'Translate text',
  weather:      'Weather info',
  wiki:         'Wikipedia',
  togif:        'Video → GIF',
  toimg:        'Sticker → image',
  tomp3:        'Video → MP3',
  // General
  fact:         'Random fact',
  joke:         'Random joke',
  meme:         'Random meme',
  alive:        'Bot status',
  ping:         'Ping bot',
  owner:        'Owner info',
  runtime:      'System stats',
};

// ─────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────
const CATEGORIES = {
  media: {
    icon: '📥', title: 'Media & Downloads', color: '🔵',
    cmds: ['song','yt','tiktok','ytmp3','ytmp4','play','lyrics','film','film1'],
  },
  admin: {
    icon: '🛡️', title: 'Admin Commands', color: '🟠',
    cmds: ['antilink','demote','goodbye','hidetag','kick','lock','members','mute','promote','setname','tagall','unlock','unmute','warn','welcome'],
  },
  owner: {
    icon: '👑', title: 'Owner Commands', color: '🟡',
    cmds: ['anticall','antidelete','antiviewonce','autoreact','autoreply','autostatus','block','broadcast','join','leave','mode','settings','unblock'],
  },
  tools: {
    icon: '🛠️', title: 'Tools & AI', color: '🟢',
    cmds: ['ai','gpt','calc','sticker','translate','weather','wiki','togif','toimg','tomp3'],
  },
  general: {
    icon: '🧭', title: 'General & Fun', color: '🟣',
    cmds: ['fact','joke','meme','alive','ping','owner','runtime'],
  },
};

const ALIAS_MAP = {
  mediamenu: 'media', dlmenu: 'media', downloadmenu: 'media',
  adminmenu: 'admin',
  ownermenu: 'owner',
  toolsmenu: 'tools', toolmenu: 'tools', utilitymenu: 'tools', aimenu: 'tools', convertermenu: 'tools',
  generalmenu: 'general', funmenu: 'general',
};

const MAIN_BUTTONS = [
  btn('mediamenu',   '📥 Media'),
  btn('adminmenu',   '🛡️ Admin'),
  btn('ownermenu',   '👑 Owner'),
  btn('toolsmenu',   '🛠️ Tools & AI'),
  btn('generalmenu', '🧭 General'),
];

// ─────────────────────────────────────────────
//  MAIN MENU TEXT BUILDER
// ─────────────────────────────────────────────
function buildMainMenu({ botName, owner, senderNum, uptimeStr, ramMB, prefix }) {
  const total = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);

  let t = '';
  t += `╭━━━━━━━━━━━━━━━━━━━━━╮\n`;
  t += `┃  🤖 *${botName}*\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━╯\n`;
  t += `\n`;
  t += `👤 *User* : @${senderNum}\n`;
  t += `👑 *Owner* : ${owner}\n`;
  t += `⌨️  *Prefix* : \`${prefix}\`\n`;
  t += `📦 *Commands* : ${total}\n`;
  t += `⏱️  *Uptime* : ${uptimeStr}\n`;
  t += `💾 *RAM* : ${ramMB} MB\n`;
  t += `\n`;
  t += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  t += `📂 *CATEGORIES*\n`;
  t += `━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const cat of Object.values(CATEGORIES)) {
    t += `${cat.color} ${cat.icon} *${cat.title}*  ·  ${cat.cmds.length} cmds\n`;
  }

  t += `\n`;
  t += `💡 _Tap a button below to explore commands_\n`;
  t += `\n`;
  t += `> ♾️ *${botName}* • infinitymd.online`;
  return t;
}

// ─────────────────────────────────────────────
//  SUBMENU TEXT BUILDER
// ─────────────────────────────────────────────
function buildSubmenu(catKey, prefix) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  // Find the longest command name for alignment
  const maxLen = Math.max(...cat.cmds.map(n => (prefix + n).length));

  let t = '';
  t += `${cat.icon} *${cat.title.toUpperCase()}*\n`;
  t += `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n`;

  cat.cmds.forEach((name, i) => {
    const cmd    = `${prefix}${name}`;
    const pad    = ' '.repeat(maxLen - cmd.length + 2);
    const label  = LABELS[name] || name;
    const num    = String(i + 1).padStart(2, ' ');
    t += `\`${num}.\` *${cmd}*${pad}· ${label}\n`;
  });

  t += `▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n`;
  t += `> ${cat.icon} *${cat.title}* • ${cat.cmds.length} commands`;
  return t;
}

// ─────────────────────────────────────────────
//  COMMAND EXPORT
// ─────────────────────────────────────────────
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
    'funmenu',
    'generalmenu',
  ],
  category: 'general',
  description: 'Show all bot commands and submenus',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId    = extra?.from || msg?.key?.remoteJid;
    const sender    = extra?.sender || msg?.key?.participant || chatId;
    const prefix    = sock?._customConfig?.settings?.prefix || config.prefix || '.';
    const botName   = sock?._customConfig?.botName || String(config.botName || 'Infinity MD Mini');
    const owner     = sock?._customConfig?.ownerName
                      || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName)
                      || 'Owner';

    const senderNum = String(sender).split('@')[0] || '';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB     = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const imgPath = pickMenuImage();
    const image   = imgPath ? { url: imgPath } : undefined;

    const usedCmd = String(extra?.commandName || '').toLowerCase().replace(prefix, '');
    const subArg  = args[0] ? String(args[0]).toLowerCase() : null;

    // ── Resolve submenu key ──
    const submenuKey =
      ALIAS_MAP[usedCmd]  ||
      ALIAS_MAP[subArg]   ||
      (CATEGORIES[usedCmd] ? usedCmd : null) ||
      (CATEGORIES[subArg]  ? subArg  : null);

    // ────────────────────────
    //  SUBMENU
    // ────────────────────────
    if (submenuKey) {
      const cat  = CATEGORIES[submenuKey];
      const text = buildSubmenu(submenuKey, prefix);
      if (!text) return sock.sendMessage(chatId, { text: '❌ Unknown menu section.' }, { quoted: msg });

      return sendBtn(sock, chatId, {
        text,
        footer: `${cat.icon} ${cat.title} • ${cat.cmds.length} commands`,
        ...(image ? { image } : {}),
        buttons: [
          btn('menu',        '🔙 Back to Menu'),
          urlBtn('🌐 Website', 'https://infinitymd.online'),
        ],
      }, { quoted: msg });
    }

    // ────────────────────────
    //  MAIN MENU
    // ────────────────────────
    const text = buildMainMenu({ botName, owner, senderNum, uptimeStr, ramMB, prefix });

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName} • ${Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0)} commands ready`,
      ...(image ? { image } : {}),
      buttons: MAIN_BUTTONS,
      mentions: [sender],
    }, { quoted: msg });
  },
};
