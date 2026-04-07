const config  = require('../../config');
const fs      = require('fs');
const path    = require('path');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');
const { getLang, t, LANGUAGES } = require('../../utils/lang');

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
      if (files.length) return path.join(bannersDir, files[Math.floor(Math.random() * files.length)]);
    }
  } catch (_) {}
  return fs.existsSync(fallback) ? fallback : null;
}

// ─────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────
const CATEGORIES = {
  media: {
    icon: '📥', titleKey: 'cat_media', color: '🔵',
    cmds: ['song','yt','tiktok','ytmp3','ytmp4','play','lyrics','film','film1','film3'],
  },
  admin: {
    icon: '🛡️', titleKey: 'cat_admin', color: '🟠',
    cmds: ['antilink','demote','goodbye','hidetag','kick','lock','members','mute','promote','setname','tagall','unlock','unmute','warn','welcome'],
  },
  owner: {
    icon: '👑', titleKey: 'cat_owner', color: '🟡',
    cmds: ['anticall','antidelete','antiviewonce','autoreact','autoreply','autostatus','block','broadcast','join','leave','mode','settings','unblock'],
  },
  tools: {
    icon: '🛠️', titleKey: 'cat_tools', color: '🟢',
    cmds: ['ai','gpt','calc','sticker','translate','weather','wiki','togif','toimg','tomp3'],
  },
  general: {
    icon: '🧭', titleKey: 'cat_general', color: '🟣',
    cmds: ['fact','joke','meme','alive','ping','owner','runtime','lang','save'],
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
  btn('toolsmenu',   '🛠️ Tools'),
  btn('generalmenu', '🧭 General'),
];

// ─────────────────────────────────────────────
//  MAIN MENU  (mobile-friendly compact layout)
// ─────────────────────────────────────────────
function buildMainMenu({ botName, owner, senderNum, uptimeStr, ramMB, prefix, lang }) {
  const total   = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
  const langFlg = LANGUAGES[lang].flag;

  let tx = `*🤖 ${botName}*\n`;
  tx += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
  tx += `👤 @${senderNum}\n`;
  tx += `👑 ${owner}   ⌨️ \`${prefix}\`\n`;
  tx += `📦 ${total} cmds   ⏱️ ${uptimeStr}\n`;
  tx += `💾 ${ramMB}MB   🌐 ${langFlg}\n`;
  tx += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;

  for (const cat of Object.values(CATEGORIES)) {
    tx += `${cat.icon} *${t(cat.titleKey, lang)}* · ${cat.cmds.length}\n`;
  }

  tx += `\n💡 _${t('tapBtn', lang)}_`;
  return tx;
}

// ─────────────────────────────────────────────
//  SUBMENU BUILDER
// ─────────────────────────────────────────────
function buildSubmenu(catKey, prefix, lang) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  const title  = t(cat.titleKey, lang);
  const maxLen = Math.max(...cat.cmds.map(n => (prefix + n).length));

  let tx = `${cat.icon} *${title}*\n`;
  tx += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;

  cat.cmds.forEach((name, i) => {
    const cmd   = `${prefix}${name}`;
    const pad   = ' '.repeat(maxLen - cmd.length + 1);
    const label = t(name, lang);
    const num   = String(i + 1).padStart(2, ' ');
    tx += `\`${num}.\` *${cmd}*${pad}· ${label}\n`;
  });

  tx += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
  tx += `> ${cat.icon} ${title} · ${cat.cmds.length} ${t('commands', lang)}`;
  return tx;
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

    // ── SUBMENU ──────────────────────────────────────────────────────────────
    if (submenuKey) {
      const cat  = CATEGORIES[submenuKey];
      const text = buildSubmenu(submenuKey, prefix, lang);
      if (!text) return sock.sendMessage(chatId, { text: '❌ Unknown menu section.' }, { quoted: msg });

      return sendBtn(sock, chatId, {
        text,
        footer: `${cat.icon} ${t(cat.titleKey, lang)} · ${cat.cmds.length} ${t('commands', lang)}`,
        ...(image ? { image } : {}),
        buttons: [
          btn('menu', t('backMenu', lang)),
          urlBtn('🌐 Website', 'https://infinitymd.online'),
        ],
      }, { quoted: msg });
    }

    // ── MAIN MENU ────────────────────────────────────────────────────────────
    const total = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
    const text  = buildMainMenu({ botName, owner, senderNum, uptimeStr, ramMB, prefix, lang });

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName} · ${total} ${t('cmdReady', lang)}`,
      ...(image ? { image } : {}),
      buttons: MAIN_BUTTONS,
      mentions: [sender],
    }, { quoted: msg });
  },
};
