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
  song:    { usage: '.song <song name>',          desc: 'Search YouTube and download the song as an MP3 audio file.',        ex: '.song Blinding Lights' },
  yt:      { usage: '.yt <query or URL>',          desc: 'Search YouTube and pick a video or audio to download.',             ex: '.yt Never Gonna Give You Up' },
  tiktok:  { usage: '.tiktok <TikTok URL>',        desc: 'Download a TikTok video without watermark.',                       ex: '.tiktok https://vm.tiktok.com/xxx' },
  ytmp3:   { usage: '.ytmp3 <YouTube URL>',        desc: 'Download a YouTube video directly as MP3 audio.',                  ex: '.ytmp3 https://youtu.be/abc123' },
  ytmp4:   { usage: '.ytmp4 <YouTube URL>',        desc: 'Download a YouTube video as MP4.',                                 ex: '.ytmp4 https://youtu.be/abc123' },
  play:    { usage: '.play <song name>',           desc: 'Search by name and instantly play/download the best match.',        ex: '.play Bohemian Rhapsody' },
  lyrics:  { usage: '.lyrics <song name>',         desc: 'Fetch the full lyrics for any song.',                              ex: '.lyrics Shape of You' },
  film:    { usage: '.film <movie name>',          desc: 'Search sinhalasub.lk for movies with Sinhala subtitles. Tap a result button to get download links.', ex: '.film Avengers' },

  // ── ADMIN ──
  antilink:{ usage: '.antilink on/off [action]',   desc: 'Auto-delete or kick users who post group invite links. Actions: delete / kick / warn.', ex: '.antilink on kick' },
  demote:  { usage: '.demote @user',               desc: 'Remove admin privileges from a tagged member.',                    ex: '.demote @user' },
  goodbye: { usage: '.goodbye on/off',             desc: 'Send a farewell message when a member leaves the group.',          ex: '.goodbye on' },
  hidetag: { usage: '.hidetag <message>',          desc: 'Silently mention all members — they get pinged without seeing the tag.', ex: '.hidetag Check this out!' },
  kick:    { usage: '.kick @user',                 desc: 'Remove a tagged or replied member from the group.',                ex: '.kick @user' },
  lock:    { usage: '.lock',                       desc: 'Lock group settings so only admins can edit group info.',           ex: '.lock' },
  members: { usage: '.members',                    desc: 'List all group members with their numbers.',                       ex: '.members' },
  mute:    { usage: '.mute',                       desc: 'Close the group so only admins can send messages.',                ex: '.mute' },
  promote: { usage: '.promote @user',              desc: 'Make a tagged member a group admin.',                              ex: '.promote @user' },
  setname: { usage: '.setname <new name>',         desc: 'Change the group name.',                                           ex: '.setname My Awesome Group' },
  tagall:  { usage: '.tagall <message>',           desc: 'Tag every member in the group with a message.',                   ex: '.tagall Meeting at 5pm!' },
  unlock:  { usage: '.unlock',                     desc: 'Unlock group settings so everyone can edit group info.',           ex: '.unlock' },
  unmute:  { usage: '.unmute',                     desc: 'Open the group so all members can send messages.',                 ex: '.unmute' },
  warn:    { usage: '.warn @user [reason]',         desc: 'Give a warning to a member. Auto-kick after 3 warnings.',         ex: '.warn @user spamming' },
  welcome: { usage: '.welcome on/off',             desc: 'Send a welcome message when a new member joins.',                  ex: '.welcome on' },

  // ── OWNER ──
  anticall:     { usage: '.anticall on/off',        desc: 'Auto-reject and optionally block anyone who calls the bot number.', ex: '.anticall on' },
  antidelete:   { usage: '.antidelete on/off',      desc: 'Re-send deleted messages back to the chat so nothing disappears.',  ex: '.antidelete on' },
  antiviewonce: { usage: '.antiviewonce on/off',    desc: 'Intercept view-once media and save a copy to your private chat.',   ex: '.antiviewonce on' },
  autoreact:    { usage: '.autoreact on/off [mode]',desc: 'Auto-react to messages with random emojis. Modes: all / cmd-only.',  ex: '.autoreact on all' },
  autoreply:    { usage: '.autoreply on/off',       desc: 'Enable AI-powered or keyword-based auto-replies.',                  ex: '.autoreply on' },
  autostatus:   { usage: '.autostatus on/off',      desc: 'Automatically view and like all WhatsApp statuses.',               ex: '.autostatus on' },
  block:        { usage: '.block @user',            desc: 'Block a user so they can no longer message the bot.',              ex: '.block @user' },
  broadcast:    { usage: '.broadcast <message>',   desc: 'Send a message to all saved contacts (owner only).',               ex: '.broadcast Hello everyone!' },
  join:         { usage: '.join <group link>',      desc: 'Make the bot join a group via an invite link.',                    ex: '.join https://chat.whatsapp.com/xxx' },
  leave:        { usage: '.leave',                  desc: 'Make the bot leave the current group.',                            ex: '.leave' },
  mode:         { usage: '.mode public/private/group', desc: 'Set who can use the bot. public = everyone, private = owner only, group = groups only.', ex: '.mode public' },
  settings:     { usage: '.settings',              desc: 'View or change all bot settings (anticall, antidelete, autoreact, etc).', ex: '.settings' },
  unblock:      { usage: '.unblock @user',          desc: 'Unblock a previously blocked user.',                              ex: '.unblock @user' },

  // ── AI ──
  ai:   { usage: '.ai <question>',                  desc: 'Chat with an AI assistant (ChatGPT-style responses).',            ex: '.ai What is the meaning of life?' },
  gpt:  { usage: '.gpt <question>',                 desc: 'Ask GPT a question and get a detailed AI response.',              ex: '.gpt Write a poem about rain' },

  // ── TOOLS ──
  calc:      { usage: '.calc <expression>',         desc: 'Evaluate a math expression.',                                     ex: '.calc (5 + 3) * 2 / 4' },
  sticker:   { usage: '.sticker <query>',           desc: 'Search and send sticker packs. Reply to an image to make a sticker.', ex: '.sticker funny cat' },
  translate: { usage: '.translate <lang> <text>',   desc: 'Translate text to any language. Use language codes (en, es, fr, si…).', ex: '.translate si Hello' },
  weather:   { usage: '.weather <city>',            desc: 'Get current weather info for any city worldwide.',                ex: '.weather Colombo' },
  wiki:      { usage: '.wiki <topic>',              desc: 'Search Wikipedia and get a summary.',                             ex: '.wiki Albert Einstein' },

  // ── CONVERTER ──
  togif:  { usage: '.togif',                        desc: 'Reply to a video or animated sticker to convert it to GIF.',      ex: 'Reply to video with .togif' },
  toimg:  { usage: '.toimg',                        desc: 'Reply to a sticker to convert it to a PNG image.',               ex: 'Reply to sticker with .toimg' },
  tomp3:  { usage: '.tomp3',                        desc: 'Reply to a video to extract and send the audio as MP3.',          ex: 'Reply to video with .tomp3' },

  // ── FUN ──
  fact:  { usage: '.fact',                          desc: 'Get a random interesting fact.',                                  ex: '.fact' },
  joke:  { usage: '.joke',                          desc: 'Get a random joke.',                                             ex: '.joke' },
  meme:  { usage: '.meme',                          desc: 'Get a random meme image.',                                       ex: '.meme' },

  // ── GENERAL ──
  alive:   { usage: '.alive',                       desc: 'Check if the bot is online and see uptime/status.',              ex: '.alive' },
  ping:    { usage: '.ping',                        desc: 'Check bot response speed (latency in ms).',                      ex: '.ping' },
  owner:   { usage: '.owner',                       desc: 'Get the bot owner contact and info.',                            ex: '.owner' },
  runtime: { usage: '.runtime',                     desc: 'Show detailed system info: RAM, CPU, uptime, Node.js version.',  ex: '.runtime' },
};

// ──────────────────────────────────────────────────────────────────────
//  CATEGORY DEFINITIONS
// ──────────────────────────────────────────────────────────────────────
const CATEGORIES = {
  media: {
    icon: '📥', title: 'MEDIA & DOWNLOADS',
    cmds: ['song','yt','tiktok','ytmp3','ytmp4','play','lyrics','film'],
  },
  admin: {
    icon: '🛡️', title: 'ADMIN COMMANDS',
    cmds: ['antilink','demote','goodbye','hidetag','kick','lock','members','mute','promote','setname','tagall','unlock','unmute','warn','welcome'],
  },
  owner: {
    icon: '👑', title: 'OWNER COMMANDS',
    cmds: ['anticall','antidelete','antiviewonce','autoreact','autoreply','autostatus','block','broadcast','join','leave','mode','settings','unblock'],
  },
  ai: {
    icon: '🤖', title: 'AI COMMANDS',
    cmds: ['ai','gpt'],
  },
  tools: {
    icon: '🛠️', title: 'TOOLS & UTILITIES',
    cmds: ['calc','sticker','translate','weather','wiki'],
  },
  converter: {
    icon: '🔄', title: 'CONVERTER',
    cmds: ['togif','toimg','tomp3'],
  },
  fun: {
    icon: '🎉', title: 'FUN COMMANDS',
    cmds: ['fact','joke','meme'],
  },
  general: {
    icon: '🧭', title: 'GENERAL',
    cmds: ['alive','ping','owner','runtime'],
  },
};

// Map submenu aliases → category key
const ALIAS_MAP = {
  mediamenu: 'media', dlmenu: 'media', downloadmenu: 'media',
  adminmenu: 'admin',
  ownermenu: 'owner',
  aimenu: 'ai',
  toolmenu: 'tools', toolsmenu: 'tools', utilitymenu: 'tools',
  convertermenu: 'converter',
  funmenu: 'fun',
  generalmenu: 'general',
};

const MAIN_BUTTONS = [
  btn('mediamenu',     '📥 Media'),
  btn('adminmenu',     '🛡️ Admin'),
  btn('ownermenu',     '👑 Owner'),
  btn('aimenu',        '🤖 AI'),
  btn('toolmenu',      '🛠️ Tools'),
  btn('convertermenu', '🔄 Converter'),
  btn('funmenu',       '🎉 Fun'),
  btn('generalmenu',   '🧭 General'),
];

// ──────────────────────────────────────────────────────────────────────
//  SUBMENU BUILDER
// ──────────────────────────────────────────────────────────────────────
function buildSubmenu(catKey, prefix, botName) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  let text = `${cat.icon} *${cat.title}*\n`;
  text += `╭━━━〔 🤖 ${botName} 〕━━━\n`;
  text += `┃ 📦 *${cat.cmds.length} commands* in this section\n`;
  text += `┃ ⌨️ Prefix: ${prefix}\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const name of cat.cmds) {
    const m = MANUALS[name] || { usage: `${prefix}${name}`, desc: name, ex: '' };
    text += `╭─〔 *${prefix}${name}* 〕\n`;
    text += `┃ 📌 *Usage:* \`${m.usage.replace(/^\./, prefix)}\`\n`;
    text += `┃ 📖 ${m.desc}\n`;
    if (m.ex) text += `┃ 💡 *Example:* ${m.ex.replace(/^\./, prefix)}\n`;
    text += `╰─────────────────────\n`;
  }

  text += `\n> _${cat.icon} ${cat.title} • Infinity MD Mini_`;
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
    text += `💡 *Tap a button below* to see commands & manual\n\n`;
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
