const config = require('../../config');
const fs = require('fs');
const path = require('path');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const _menuReply = { resolveNumberReply: () => null };

function formatUptime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
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

// ──────────────────────────────────────────────────────────────────────
//  COMMAND MANUALS — usage + description for every command
// ──────────────────────────────────────────────────────────────────────
const MANUALS = {
  // ── MEDIA ──
  song:    { usage: '.song <song name>',          desc: 'Download a song as MP3 audio.',                                    ex: '.song Blinding Lights' },
  yt:      { usage: '.yt <query or URL>',          desc: 'Search YouTube and pick a video or audio.',                        ex: '.yt Never Gonna Give You Up' },
  tiktok:  { usage: '.tiktok <TikTok URL>',        desc: 'Download TikTok video without watermark.',                         ex: '.tiktok https://vm.tiktok.com/xxx' },
  ytmp3:   { usage: '.ytmp3 <YouTube URL>',        desc: 'Download a YouTube video as MP3.',                                 ex: '.ytmp3 https://youtu.be/abc123' },
  ytmp4:   { usage: '.ytmp4 <YouTube URL>',        desc: 'Download a YouTube video as MP4.',                                 ex: '.ytmp4 https://youtu.be/abc123' },
  play:    { usage: '.play <song name>',           desc: 'Instantly play/download the best match for a song.',               ex: '.play Bohemian Rhapsody' },
  lyrics:  { usage: '.lyrics <song name>',         desc: 'Get the full lyrics for any song.',                               ex: '.lyrics Shape of You' },
  film:    { usage: '.film <movie name>',          desc: 'Search and download movies with Sinhala subtitles.',               ex: '.film Avengers' },
  film1:   { usage: '.film1 <movie name>',         desc: 'Search SriHub for movies with Sinhala subtitles.',                 ex: '.film1 Avengers' },

  // ── ADMIN ──
  antilink:{ usage: '.antilink on/off [action]',   desc: 'Auto-delete/kick users who post group invite links.',             ex: '.antilink on kick' },
  demote:  { usage: '.demote @user',               desc: 'Remove admin privileges from a member.',                          ex: '.demote @user' },
  goodbye: { usage: '.goodbye on/off',             desc: 'Send a farewell message when a member leaves.',                   ex: '.goodbye on' },
  hidetag: { usage: '.hidetag <message>',          desc: 'Silently mention all members.',                                   ex: '.hidetag Check this out!' },
  kick:    { usage: '.kick @user',                 desc: 'Remove a member from the group.',                                 ex: '.kick @user' },
  lock:    { usage: '.lock',                       desc: 'Lock group so only admins can edit info.',                        ex: '.lock' },
  members: { usage: '.members',                    desc: 'List all group members with their numbers.',                      ex: '.members' },
  mute:    { usage: '.mute',                       desc: 'Close the group — only admins can send messages.',                ex: '.mute' },
  promote: { usage: '.promote @user',              desc: 'Make a member a group admin.',                                    ex: '.promote @user' },
  setname: { usage: '.setname <new name>',         desc: 'Change the group name.',                                          ex: '.setname My Group' },
  tagall:  { usage: '.tagall <message>',           desc: 'Tag every member with a message.',                                ex: '.tagall Meeting at 5pm!' },
  unlock:  { usage: '.unlock',                     desc: 'Unlock group so everyone can edit info.',                         ex: '.unlock' },
  unmute:  { usage: '.unmute',                     desc: 'Open the group so all members can send.',                         ex: '.unmute' },
  warn:    { usage: '.warn @user [reason]',         desc: 'Warn a member. Auto-kick after 3 warnings.',                     ex: '.warn @user spamming' },
  welcome: { usage: '.welcome on/off',             desc: 'Send a welcome message when a member joins.',                     ex: '.welcome on' },

  // ── OWNER ──
  anticall:     { usage: '.anticall on/off',        desc: 'Auto-reject anyone who calls the bot.',                          ex: '.anticall on' },
  antidelete:   { usage: '.antidelete on/off',      desc: 'Re-send deleted messages back to chat.',                         ex: '.antidelete on' },
  antiviewonce: { usage: '.antiviewonce on/off',    desc: 'Save a copy of view-once media.',                                ex: '.antiviewonce on' },
  autoreact:    { usage: '.autoreact on/off [mode]',desc: 'Auto-react to messages with emojis.',                            ex: '.autoreact on all' },
  autoreply:    { usage: '.autoreply on/off',       desc: 'Enable AI-powered auto-replies.',                                ex: '.autoreply on' },
  autostatus:   { usage: '.autostatus on/off',      desc: 'Auto-view and like all WhatsApp statuses.',                      ex: '.autostatus on' },
  block:        { usage: '.block @user',            desc: 'Block a user from messaging the bot.',                           ex: '.block @user' },
  broadcast:    { usage: '.broadcast <message>',   desc: 'Send a message to all saved contacts.',                           ex: '.broadcast Hello!' },
  join:         { usage: '.join <group link>',      desc: 'Make the bot join a group via invite link.',                     ex: '.join https://chat.whatsapp.com/xxx' },
  leave:        { usage: '.leave',                  desc: 'Make the bot leave the current group.',                          ex: '.leave' },
  mode:         { usage: '.mode public/private/group', desc: 'Set who can use the bot.',                                   ex: '.mode public' },
  settings:     { usage: '.settings',              desc: 'View or change all bot settings.',                                ex: '.settings' },
  unblock:      { usage: '.unblock @user',          desc: 'Unblock a previously blocked user.',                             ex: '.unblock @user' },

  // ── TOOLS (AI + Tools + Converter) ──
  ai:        { usage: '.ai <question>',             desc: 'Chat with an AI assistant.',                                     ex: '.ai What is the meaning of life?' },
  gpt:       { usage: '.gpt <question>',            desc: 'Ask GPT a question and get a detailed response.',                ex: '.gpt Write a poem about rain' },
  calc:      { usage: '.calc <expression>',         desc: 'Evaluate a math expression.',                                    ex: '.calc (5 + 3) * 2' },
  sticker:   { usage: '.sticker',                   desc: 'Reply to an image to convert it to a sticker.',                 ex: 'Reply to image with .sticker' },
  translate: { usage: '.translate <lang> <text>',   desc: 'Translate text to any language.',                               ex: '.translate si Hello' },
  weather:   { usage: '.weather <city>',            desc: 'Get current weather info for any city.',                         ex: '.weather Colombo' },
  wiki:      { usage: '.wiki <topic>',              desc: 'Search Wikipedia and get a summary.',                            ex: '.wiki Albert Einstein' },
  togif:     { usage: '.togif',                     desc: 'Reply to a video or sticker to convert to GIF.',                ex: 'Reply to video with .togif' },
  toimg:     { usage: '.toimg',                     desc: 'Reply to a sticker to convert it to an image.',                 ex: 'Reply to sticker with .toimg' },
  tomp3:     { usage: '.tomp3',                     desc: 'Reply to a video to extract audio as MP3.',                     ex: 'Reply to video with .tomp3' },

  // ── GENERAL (Fun + General) ──
  fact:    { usage: '.fact',                        desc: 'Get a random interesting fact.',                                  ex: '.fact' },
  joke:    { usage: '.joke',                        desc: 'Get a random joke.',                                             ex: '.joke' },
  meme:    { usage: '.meme',                        desc: 'Get a random meme image.',                                       ex: '.meme' },
  alive:   { usage: '.alive',                       desc: 'Check if the bot is online and see uptime.',                    ex: '.alive' },
  ping:    { usage: '.ping',                        desc: 'Check bot response speed.',                                      ex: '.ping' },
  owner:   { usage: '.owner',                       desc: 'Get the bot owner contact.',                                    ex: '.owner' },
  runtime: { usage: '.runtime',                     desc: 'Show RAM, CPU, uptime and Node.js info.',                        ex: '.runtime' },
};

// ──────────────────────────────────────────────────────────────────────
//  CATEGORY DEFINITIONS  (5 categories — mini version)
// ──────────────────────────────────────────────────────────────────────
const CATEGORIES = {
  media: {
    icon: '📥', title: 'MEDIA & DOWNLOADS',
    cmds: ['song','yt','tiktok','ytmp3','ytmp4','play','lyrics','film','film1'],
  },
  admin: {
    icon: '🛡️', title: 'ADMIN COMMANDS',
    cmds: ['antilink','demote','goodbye','hidetag','kick','lock','members','mute','promote','setname','tagall','unlock','unmute','warn','welcome'],
  },
  owner: {
    icon: '👑', title: 'OWNER COMMANDS',
    cmds: ['anticall','antidelete','antiviewonce','autoreact','autoreply','autostatus','block','broadcast','join','leave','mode','settings','unblock'],
  },
  tools: {
    icon: '🛠️', title: 'TOOLS & AI',
    cmds: ['ai','gpt','calc','sticker','translate','weather','wiki','togif','toimg','tomp3'],
  },
  general: {
    icon: '🧭', title: 'GENERAL',
    cmds: ['fact','joke','meme','alive','ping','owner','runtime'],
  },
};

// Map submenu aliases → category key
const ALIAS_MAP = {
  mediamenu: 'media', dlmenu: 'media', downloadmenu: 'media',
  adminmenu: 'admin',
  ownermenu: 'owner',
  toolsmenu: 'tools', toolmenu: 'tools', utilitymenu: 'tools', aimenu: 'tools', convertermenu: 'tools',
  generalmenu: 'general', funmenu: 'general',
};

const MAIN_BUTTONS = [
  btn('mediamenu',  '📥 Media'),
  btn('adminmenu',  '🛡️ Admin'),
  btn('ownermenu',  '👑 Owner'),
  btn('toolsmenu',  '🛠️ Tools & AI'),
  btn('generalmenu','🧭 General'),
];

// ──────────────────────────────────────────────────────────────────────
//  SUBMENU BUILDER
// ──────────────────────────────────────────────────────────────────────
function buildSubmenu(catKey, prefix, botName) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  let text = `${cat.icon} *${cat.title}*\n`;
  text += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
  text += `📦 *${cat.cmds.length} commands* available\n\n`;

  for (const name of cat.cmds) {
    const m = MANUALS[name] || { usage: `${prefix}${name}`, desc: name, ex: '' };
    text += `▸ *${prefix}${name}*\n`;
    text += `  ${m.desc}\n`;
    if (m.ex) text += `  _e.g. ${m.ex.replace(/^\./, prefix)}_\n`;
    text += `\n`;
  }

  text += `> _${cat.icon} ${cat.title} • Infinity MD Mini_`;
  return text;
}

// ──────────────────────────────────────────────────────────────────────
//  COMMAND EXPORT
// ──────────────────────────────────────────────────────────────────────
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
  description: 'Show all bot commands and manuals',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId   = extra?.from || msg?.key?.remoteJid;
    const sender   = extra?.sender || msg?.key?.participant || chatId;
    const prefix   = (sock?._customConfig?.settings?.prefix) || config.prefix || '.';
    const botName  = (sock?._customConfig?.botName) || String(config.botName || 'Infinity MD Mini');
    const owner    = (sock?._customConfig?.ownerName) || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName) || 'Owner';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB    = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const senderNum = String(sender).split('@')[0] || '';

    const imgPath = pickMenuImage();
    const image   = imgPath ? { url: imgPath } : undefined;

    const usedCommand = String(extra?.commandName || '').toLowerCase().replace(prefix, '');
    const subArg      = (args[0] && String(args[0]).toLowerCase()) || null;

    // ── detect which submenu was requested ──
    const submenuKey =
      ALIAS_MAP[usedCommand] ||
      ALIAS_MAP[subArg] ||
      (CATEGORIES[usedCommand] ? usedCommand : null) ||
      (CATEGORIES[subArg]      ? subArg      : null);

    // ── SUBMENU ──
    if (submenuKey) {
      const cat = CATEGORIES[submenuKey];
      const text = buildSubmenu(submenuKey, prefix, botName);
      if (!text) return sock.sendMessage(chatId, { text: '❌ Unknown menu section.' }, { quoted: msg });

      const subButtons = [
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', 'https://infinitymd.online'),
      ];

      return sendBtn(sock, chatId, {
        text,
        footer: `♾️ ${botName} • ${cat.icon} ${cat.title}`,
        ...(image ? { image } : {}),
        buttons: subButtons,
      }, { quoted: msg });
    }

    // ── MAIN MENU ──
    const totalCmds = Object.values(CATEGORIES).reduce((a, c) => a + c.cmds.length, 0);

    let text = `╭━━━〔 🤖 *${botName}* 〕━━━\n`;
    text += `┃ 👤 *User* : @${senderNum}\n`;
    text += `┃ 👑 *Owner* : ${owner}\n`;
    text += `┃ 📦 *Commands* : ${totalCmds}\n`;
    text += `┃ ⏱ *Uptime* : ${uptimeStr}\n`;
    text += `┃ 🚀 *RAM* : ${ramMB} MB\n`;
    text += `┃ ⌨️ *Prefix* : ${prefix}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 📂 *CATEGORIES* 〕━━\n`;
    for (const [, cat] of Object.entries(CATEGORIES)) {
      text += `┃ ${cat.icon} *${cat.title}* — ${cat.cmds.length} cmds\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `💡 *Tap a button below* to see commands\n\n`;
    text += `> _Infinity MD Mini • infinitymd.online_`;

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName} • ${totalCmds} commands ready`,
      ...(image ? { image } : {}),
      buttons: MAIN_BUTTONS,
      mentions: [sender],
    }, { quoted: msg });
  },
};

module.exports._menuReply = _menuReply;
