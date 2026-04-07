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
//  COMMAND MANUALS
// ─────────────────────────────────────────────
const MANUALS = {
  // Media
  song:    { usage: '<song name>',         desc: 'Download a song as MP3 audio' },
  yt:      { usage: '<query or URL>',      desc: 'Search YouTube and pick video / audio' },
  tiktok:  { usage: '<TikTok URL>',        desc: 'Download TikTok video without watermark' },
  ytmp3:   { usage: '<YouTube URL>',       desc: 'Download a YouTube video as MP3' },
  ytmp4:   { usage: '<YouTube URL>',       desc: 'Download a YouTube video as MP4' },
  play:    { usage: '<song name>',         desc: 'Instantly download the best song match' },
  lyrics:  { usage: '<song name>',         desc: 'Get full song lyrics' },
  film:    { usage: '<movie name>',        desc: 'Find movies with Sinhala subtitles' },
  film1:   { usage: '<movie name>',        desc: 'Search SriHub for Sinhala subtitle films' },
  // Admin
  antilink:{ usage: 'on/off [action]',     desc: 'Auto-remove users who post invite links' },
  demote:  { usage: '@user',               desc: 'Remove admin from a member' },
  goodbye: { usage: 'on/off',              desc: 'Farewell message when a member leaves' },
  hidetag: { usage: '<message>',           desc: 'Silently mention all members' },
  kick:    { usage: '@user',               desc: 'Remove a member from the group' },
  lock:    { usage: '',                    desc: 'Lock group — only admins can send' },
  members: { usage: '',                    desc: 'List all group members' },
  mute:    { usage: '',                    desc: 'Mute group for non-admins' },
  promote: { usage: '@user',               desc: 'Make a member a group admin' },
  setname: { usage: '<new name>',          desc: 'Change the group name' },
  tagall:  { usage: '<message>',           desc: 'Tag every member with a message' },
  unlock:  { usage: '',                    desc: 'Unlock group so everyone can edit info' },
  unmute:  { usage: '',                    desc: 'Open the group for all members' },
  warn:    { usage: '@user [reason]',      desc: 'Warn a member — auto-kick at 3 warns' },
  welcome: { usage: 'on/off',              desc: 'Welcome message when a member joins' },
  // Owner
  anticall:     { usage: 'on/off',         desc: 'Auto-reject anyone who calls the bot' },
  antidelete:   { usage: 'on/off',         desc: 'Re-send deleted messages back to chat' },
  antiviewonce: { usage: 'on/off',         desc: 'Save a copy of view-once media' },
  autoreact:    { usage: 'on/off [mode]',  desc: 'Auto-react to messages with emojis' },
  autoreply:    { usage: 'on/off',         desc: 'Enable AI-powered auto-replies' },
  autostatus:   { usage: 'on/off',         desc: 'Auto-view and like all statuses' },
  block:        { usage: '@user',          desc: 'Block a user from messaging the bot' },
  broadcast:    { usage: '<message>',      desc: 'Send a message to all saved contacts' },
  join:         { usage: '<group link>',   desc: 'Make bot join a group via invite link' },
  leave:        { usage: '',               desc: 'Make the bot leave current group' },
  mode:         { usage: 'public/private', desc: 'Set who can use the bot' },
  settings:     { usage: '',               desc: 'View or change all bot settings' },
  unblock:      { usage: '@user',          desc: 'Unblock a previously blocked user' },
  // Tools / AI
  ai:        { usage: '<question>',        desc: 'Chat with an AI assistant' },
  gpt:       { usage: '<question>',        desc: 'Ask GPT and get a detailed response' },
  calc:      { usage: '<expression>',      desc: 'Evaluate a math expression' },
  sticker:   { usage: '(reply to image)',  desc: 'Convert image to a WhatsApp sticker' },
  translate: { usage: '<lang> <text>',     desc: 'Translate text to any language' },
  weather:   { usage: '<city>',            desc: 'Get current weather for any city' },
  wiki:      { usage: '<topic>',           desc: 'Search Wikipedia for a quick summary' },
  togif:     { usage: '(reply to video)',  desc: 'Convert video / sticker to GIF' },
  toimg:     { usage: '(reply to sticker)',desc: 'Convert sticker to an image' },
  tomp3:     { usage: '(reply to video)',  desc: 'Extract audio from a video as MP3' },
  // General
  fact:    { usage: '', desc: 'Get a random interesting fact' },
  joke:    { usage: '', desc: 'Get a random joke' },
  meme:    { usage: '', desc: 'Get a random meme image' },
  alive:   { usage: '', desc: 'Check if bot is online and see uptime' },
  ping:    { usage: '', desc: 'Check bot response speed' },
  owner:   { usage: '', desc: 'Get the bot owner contact' },
  runtime: { usage: '', desc: 'Show RAM, CPU, uptime and Node.js info' },
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

  const line = '━━━━━━━━━━━━━━━━━━━━━━━';
  let t = '';
  t += `${line}\n`;
  t += `${cat.icon}  *${cat.title.toUpperCase()}*\n`;
  t += `${line}\n`;
  t += `📦 *${cat.cmds.length} commands* available\n`;
  t += `\n`;

  for (const name of cat.cmds) {
    const m = MANUALS[name] || { usage: '', desc: name };
    const usageStr = m.usage ? ` ${m.usage}` : '';
    t += `◈ *${prefix}${name}*${usageStr}\n`;
    t += `   └ ${m.desc}\n`;
    t += `\n`;
  }

  t += `> ${cat.icon} *${cat.title}* • Infinity MD Mini`;
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
