const config = require('../../config');
const database = require('../../database');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

async function safeSend(sock, from, payload, opts, fallbackFn) {
  try {
    await sendBtn(sock, from, payload, opts);
  } catch {
    await fallbackFn(payload.text);
  }
}

module.exports = {
  name: 'mode',
  aliases: ['botmode', 'privatemode', 'publicmode'],
  description: 'Toggle bot between private and public mode',
  usage: '.mode <private/public>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const isPrivate = globalSettings.forceBot;

      const navBtns = [
        btn('ownermenu', '👑 Owner Menu'),
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', CHANNEL_URL),
      ];

      if (!args[0]) {
        return safeSend(sock, extra.from, {
          text:
            `╭━━〔 🤖 *BOT MODE* 〕━━⬣\n` +
            `┃\n` +
            `┃  ${isPrivate ? '🔒' : '🌐'} *Mode:* ${isPrivate ? 'PRIVATE' : 'PUBLIC'}\n` +
            `┃  📝 ${isPrivate ? 'Only owner can use commands' : 'Everyone can use commands'}\n` +
            `┃\n` +
            `┃  Usage: .mode private / .mode public\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
          footer: `♾️ Infinity MD`,
          buttons: [
            btn(isPrivate ? 'mode_public' : 'mode_private',
                isPrivate ? '🌐 Switch to PUBLIC' : '🔒 Switch to PRIVATE'),
            btn('ownermenu', '👑 Owner Menu'),
            urlBtn('🌐 Website', CHANNEL_URL),
          ],
        }, { quoted: msg }, extra.reply);
      }

      const mode = args[0].toLowerCase();

      if (mode === 'private' || mode === 'priv') {
        if (isPrivate) {
          return safeSend(sock, extra.from, { text: `🔒 Already in *PRIVATE* mode.`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg }, extra.reply);
        }
        await database.updateGlobalSettings({ forceBot: true });
        return safeSend(sock, extra.from, {
          text: `🔒 *Bot mode → PRIVATE*\n\nOnly the owner can use commands now.`,
          footer: `♾️ Infinity MD`, buttons: navBtns
        }, { quoted: msg }, extra.reply);
      }

      if (mode === 'public' || mode === 'pub') {
        if (!isPrivate) {
          return safeSend(sock, extra.from, { text: `🌐 Already in *PUBLIC* mode.`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg }, extra.reply);
        }
        await database.updateGlobalSettings({ forceBot: false });
        return safeSend(sock, extra.from, {
          text: `🌐 *Bot mode → PUBLIC*\n\nEveryone can use commands now.`,
          footer: `♾️ Infinity MD`, buttons: navBtns
        }, { quoted: msg }, extra.reply);
      }

      return extra.reply('❌ Invalid mode!\nUsage: .mode private / .mode public');

    } catch (error) {
      console.error('Mode command error:', error);
      await extra.reply('❌ Error changing bot mode.');
    }
  }
};
