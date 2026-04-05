const config = require('../../config');
const fs = require('fs');
const path = require('path');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

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

const _menuReply = { resolveNumberReply: () => null };

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  category: 'general',
  description: 'Show all bot commands',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;
    const prefix = (sock?._customConfig?.settings?.prefix) || config.prefix || '.';
    const botName = (sock?._customConfig?.botName) || String(config.botName || 'INFINITY MD');
    const owner = (sock?._customConfig?.ownerName) || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName) || 'Owner';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const senderNum = String(sender).split('@')[0] || '';

    const imgPath = pickMenuImage();
    const image = imgPath ? { url: imgPath } : undefined;

    const p = prefix;

    let text = '';
    text += `╭━━━〔 🤖 *${botName}* 〕━━━\n`;
    text += `┃ 👤 User  : @${senderNum}\n`;
    text += `┃ 👑 Owner : ${owner}\n`;
    text += `┃ ⏱ Uptime : ${uptimeStr}\n`;
    text += `┃ 🚀 RAM   : ${ramMB} MB\n`;
    text += `┃ ⌨️ Prefix : ${p}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 📥 *MEDIA* 〕━━\n`;
    text += `┃ ${p}song  ${p}yt  ${p}tiktok\n`;
    text += `┃ ${p}ytmp3  ${p}ytmp4  ${p}play\n`;
    text += `┃ ${p}lyrics\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 🛡️ *ADMIN* 〕━━\n`;
    text += `┃ ${p}kick  ${p}promote  ${p}demote\n`;
    text += `┃ ${p}warn  ${p}mute  ${p}unmute\n`;
    text += `┃ ${p}lock  ${p}unlock  ${p}tagall\n`;
    text += `┃ ${p}hidetag  ${p}members  ${p}setname\n`;
    text += `┃ ${p}antilink  ${p}welcome  ${p}goodbye\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 👑 *OWNER* 〕━━\n`;
    text += `┃ ${p}anticall  ${p}antidelete\n`;
    text += `┃ ${p}antiviewonce  ${p}autoreact\n`;
    text += `┃ ${p}autostatus  ${p}autoreply\n`;
    text += `┃ ${p}broadcast  ${p}mode\n`;
    text += `┃ ${p}block  ${p}unblock\n`;
    text += `┃ ${p}join  ${p}leave  ${p}settings\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 🤖 *AI* 〕━━\n`;
    text += `┃ ${p}ai  ${p}gpt\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 🛠️ *TOOLS* 〕━━\n`;
    text += `┃ ${p}translate  ${p}weather\n`;
    text += `┃ ${p}wiki  ${p}calc  ${p}sticker\n`;
    text += `┃ ${p}toimg  ${p}tomp3  ${p}togif\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 🎉 *FUN* 〕━━\n`;
    text += `┃ ${p}joke  ${p}fact  ${p}meme\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `╭━━〔 🧭 *GENERAL* 〕━━\n`;
    text += `┃ ${p}alive  ${p}ping  ${p}owner\n`;
    text += `┃ ${p}runtime\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━`;

    const buttons = [
      btn('alive',  '✅ Status'),
      btn('ping',   '🏓 Ping'),
      urlBtn('🌐 Website', 'https://infinitymd.online'),
    ];

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName}`,
      ...(image ? { image } : {}),
      buttons,
      mentions: [sender]
    }, { quoted: msg });
  }
};

module.exports._menuReply = _menuReply;
