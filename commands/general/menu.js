/**
 * Infinity MD - Menu System
 * File: commands/general/menu.js
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const SITE_URL = 'https://infinitymd.online';

// -------------------- Number reply session (in-memory) --------------------
const MENU_TTL_MS = 2 * 60 * 1000;
const MENU_SESSIONS = new Map();

function skey(chatId, sender) { return `${chatId}:${sender}`; }

function setSession(chatId, sender, map) {
  MENU_SESSIONS.set(skey(chatId, sender), { expiresAt: Date.now() + MENU_TTL_MS, map });
}

function getSession(chatId, sender) {
  const s = MENU_SESSIONS.get(skey(chatId, sender));
  if (!s) return null;
  if (Date.now() > s.expiresAt) { MENU_SESSIONS.delete(skey(chatId, sender)); return null; }
  return s;
}

function clearSession(chatId, sender) { MENU_SESSIONS.delete(skey(chatId, sender)); }

function resolveNumberReply(chatId, sender, text) {
  const t = String(text || '').trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const s = getSession(chatId, sender);
  if (!s) return null;
  const cmd = s.map[t];
  if (!cmd) return null;
  clearSession(chatId, sender);
  return cmd;
}

// -------------------- Helpers --------------------
function formatUptime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function mentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function pickMenuImage() {
  const bannersPath = path.join(__dirname, '../../utils/banners');
  let imagePath = path.join(__dirname, '../../utils/bot_image.jpg');
  try {
    if (fs.existsSync(bannersPath)) {
      const banners = fs.readdirSync(bannersPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (banners.length) imagePath = path.join(bannersPath, banners[Math.floor(Math.random() * banners.length)]);
    }
  } catch (_) {}
  return fs.existsSync(imagePath) ? imagePath : null;
}

const HIDDEN_CATEGORIES = new Set(['nsfw', 'datagame']);

function buildCategoriesMap(commands) {
  const categories = {};
  const cmdList = Array.isArray(commands) ? commands : (commands instanceof Map ? Array.from(commands.values()) : []);
  const seen = new Set();
  for (const cmd of cmdList) {
    if (!cmd?.name) continue;
    if (seen.has(cmd.name)) continue;
    seen.add(cmd.name);
    const cat = String(cmd.category || 'other').toLowerCase().trim();
    if (HIDDEN_CATEGORIES.has(cat)) continue;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  }
  return { categories, total: seen.size };
}

/*
 * BUTTON STRATEGY:
 * We use the exact command alias as the button ID (e.g. 'ownermenu', 'adminmenu').
 * This way WhatsApp returns the alias string, and the handler's command-lookup
 * fallback ("known command name → add prefix") converts it to '.ownermenu' etc.
 *
 * This works regardless of whether gifted-btns returns the raw ID or display text,
 * because we also register display-text → command in btnCmdMap in handler.js.
 */
const MAIN_BUTTONS = [
  btn('ownermenu',         '👑 Owner'),
  btn('adminmenu',         '🛡️ Admin'),
  btn('dlmenu',            '📥 Downloads'),
  btn('funmenu',           '🎮 Fun'),
  btn('aimenu',            '🤖 AI'),
  btn('toolmenu',          '🛠️ Tools'),
  btn('entertainmentmenu', '👾 Entertainment'),
  btn('textmenu',          '✍️ TextMaker'),
  btn('moviemenu',         '🎬 Movies'),
  btn('generalmenu',       '🧭 General'),
  btn('convertermenu',     '🔄 Converter'),
  btn('gamemenu',          '🎮 Games'),
  urlBtn('🌐 Website',     SITE_URL),
];

// -------------------- Command --------------------
module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'ownermenu', 'adminmenu', 'dlmenu', 'funmenu', 'aimenu',
    'toolmenu', 'entertainmentmenu', 'textmenu', 'moviemenu', 'generalmenu',
    'convertermenu', 'gamemenu',
    'animemenu', 'toolsmenu'
  ],
  category: 'general',
  description: 'Show menu + submenus',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = (sock?._customConfig?.botName) || String(config.botName || 'INFINITY MD');
    const commands = loadCommands();
    const { categories, total } = buildCategoriesMap(commands);
    const owner = (sock?._customConfig?.ownerName) || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName) || 'Infinity Team';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    const usedCommand = String(extra?.commandName || '').toLowerCase();
    const subMenu =
      (args[0] && String(args[0]).toLowerCase()) ||
      (usedCommand.endsWith('menu') && usedCommand !== 'menu' ? usedCommand : null);

    const imgPath = pickMenuImage();
    const image = imgPath ? { url: imgPath } : undefined;

    // ---------------- MAIN MENU ----------------
    if (!subMenu) {
      const who = mentionTag(sender);

      // Number map: position matches button order (1-indexed)
      const numberMap = {
        '1':  `${prefix}ownermenu`,
        '2':  `${prefix}adminmenu`,
        '3':  `${prefix}dlmenu`,
        '4':  `${prefix}funmenu`,
        '5':  `${prefix}aimenu`,
        '6':  `${prefix}toolmenu`,
        '7':  `${prefix}entertainmentmenu`,
        '8':  `${prefix}textmenu`,
        '9':  `${prefix}moviemenu`,
        '10': `${prefix}generalmenu`,
        '11': `${prefix}convertermenu`,
        '12': `${prefix}gamemenu`,
      };
      setSession(chatId, sender, numberMap);

      let menuText = `╭───〔 🤖 ${botName} 〕───\n`;
      menuText += `│ 👋 *User* : ${who}\n`;
      menuText += `│ 👤 *Owner* : ${owner}\n`;
      menuText += `│ 📊 *Commands* : ${total}\n`;
      menuText += `│ ⏱ *Uptime* : ${uptimeStr}\n`;
      menuText += `│ 🚀 *RAM* : ${ramMB}MB\n`;
      menuText += `│ ⌨️ *Prefix* : ${prefix}\n`;
      menuText += `╰────────────────────\n\n`;
      menuText += `💡 *Tap a category button below*\n\n`;
      menuText += `╭───〔 🌟 CREDITS 〕───\n`;
      menuText += `│ 💻 *Powered by* Chanchana\n`;
      menuText += `│ 🔧 *Code by* Savi\n`;
      menuText += `╰────────────────────`;

      return sendBtn(sock, chatId, {
        text: menuText,
        footer: `♾️ ${botName} • infinitymd.online`,
        ...(image ? { image } : {}),
        buttons: MAIN_BUTTONS
      }, { quoted: msg });
    }

    // ---------------- SUBMENUS ----------------
    let category = '';
    let title = '';

    switch (subMenu) {
      case 'ownermenu':            category = 'owner';         title = '👑 OWNER MENU'; break;
      case 'adminmenu':            category = 'admin';         title = '🛡️ ADMIN MENU'; break;
      case 'dlmenu':               category = 'media';         title = '📥 MEDIA MENU'; break;
      case 'funmenu':              category = 'fun';           title = '🎮 FUN MENU'; break;
      case 'aimenu':               category = 'ai';            title = '🤖 AI MENU'; break;
      case 'toolmenu':             category = 'utility';       title = '🛠 TOOLS MENU'; break;
      case 'entertainmentmenu':    category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'textmenu':             category = 'textmaker';     title = '✍️ TEXT MENU'; break;
      case 'moviemenu':            category = 'movie';         title = '🎬 MOVIE MENU'; break;
      case 'generalmenu':          category = 'general';       title = '🧭 GENERAL MENU'; break;
      case 'convertermenu':        category = 'converter';     title = '🔄 CONVERTER MENU'; break;
      case 'gamemenu':             category = 'game';          title = '🎮 GAMES MENU'; break;

      case 'owner':                category = 'owner';         title = '👑 OWNER MENU'; break;
      case 'admin':                category = 'admin';         title = '🛡️ ADMIN MENU'; break;
      case 'media':                category = 'media';         title = '📥 MEDIA MENU'; break;
      case 'fun':                  category = 'fun';           title = '🎮 FUN MENU'; break;
      case 'ai':                   category = 'ai';            title = '🤖 AI MENU'; break;
      case 'utility':              category = 'utility';       title = '🛠 TOOLS MENU'; break;
      case 'entertainment':        category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'textmaker':            category = 'textmaker';     title = '✍️ TEXT MENU'; break;
      case 'movies': case 'movie': category = 'movie';         title = '🎬 MOVIE MENU'; break;
      case 'general':              category = 'general';       title = '🧭 GENERAL MENU'; break;
      case 'converter':            category = 'converter';     title = '🔄 CONVERTER MENU'; break;
      case 'game': case 'games':   category = 'game';          title = '🎮 GAMES MENU'; break;

      case 'animemenu':            category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'toolsmenu':            category = 'utility';       title = '🛠 TOOLS MENU'; break;

      default:
        return sock.sendMessage(chatId, { text: '❌ Invalid menu category!' }, { quoted: msg });
    }

    const list = (categories[category] || []).map(x => x.name).filter(Boolean);
    list.sort((a, b) => String(a).localeCompare(String(b)));

    if (!list.length) {
      return sock.sendMessage(chatId, { text: `❌ No commands found in ${title}` }, { quoted: msg });
    }

    // Build submenu number map: 0 = back to main, 1-N = commands
    // NOTE: do NOT set session here — we keep button clicks via btnCmdMap IDs only.
    // Users can still type numbers (0-N) because the submenu map is set below.
    const submenuMap = { '0': `${prefix}menu` };
    let cmdLines = '';
    for (let i = 0; i < list.length; i++) {
      const n = String(i + 1);
      submenuMap[n] = `${prefix}${list[i]}`;
      cmdLines += `│ ${n.padStart(2, '0')} ➜ ${list[i]}\n`;
    }
    setSession(chatId, sender, submenuMap);

    let submenuText = `${title}\n`;
    submenuText += `╭───〔 🤖 ${botName} 〕───\n`;
    submenuText += `│ 📦 *Total* : ${list.length} commands\n`;
    submenuText += `│ ⌨️ *Prefix* : ${prefix}\n`;
    submenuText += `╰────────────────────\n\n`;
    submenuText += `╭───〔 ✅ COMMANDS 〕───\n`;
    submenuText += cmdLines;
    submenuText += `╰────────────────────\n\n`;
    submenuText += `💡 Reply a number (1-${list.length}) to run • *0* = Main Menu\n\n`;
    submenuText += `╭───〔 🌟 CREDITS 〕───\n`;
    submenuText += `│ 💻 *Powered by* Chanchana\n`;
    submenuText += `│ 🔧 *Code by* Savi\n`;
    submenuText += `╰────────────────────`;

    // Submenu buttons: 2 clean buttons only — avoids gifted-btns overflow & "same menu" loop
    const subButtons = [
      btn('menu',          '🔙 Main Menu'),
      urlBtn('🌐 Website', SITE_URL),
    ];

    return sendBtn(sock, chatId, {
      text: submenuText,
      footer: `♾️ ${botName} • infinitymd.online`,
      ...(image ? { image } : {}),
      buttons: subButtons
    }, { quoted: msg });
  }
};

module.exports._menuReply = { resolveNumberReply };
