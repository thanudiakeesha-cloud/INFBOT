const database = require('../../database');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

module.exports = {
  name: 'autoreact',
  aliases: ['reactmode'],
  category: 'owner',
  description: 'Configure automatic reactions to messages',
  usage: '.autoreact <on/off/set bot/set all>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const sessionSettings = sock._customConfig?.settings || {};
      const effectiveSettings = { ...globalSettings, ...sessionSettings };

      const enabled = effectiveSettings.autoReact || false;
      const mode    = effectiveSettings.autoReactMode || 'all';

      const navBtns = [
        btn('ownermenu', '👑 Owner Menu'),
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', CHANNEL_URL),
      ];

      if (!args[0]) {
        return sendBtn(sock, extra.from, {
          text:
            `╭━━〔 ⚡ *AUTO-REACT* 〕━━⬣\n` +
            `┃\n` +
            `┃  🔒 *Status:* ${enabled ? '✅ ON' : '❌ OFF'}\n` +
            `┃  🎯 *Mode:* ${mode === 'cmd-only' ? '🤖 Bot Commands Only' : '🌟 All Messages'}\n` +
            `┃\n` +
            `┃  Usage: .autoreact on/off/set bot/set all\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
          footer: `♾️ Infinity MD`,
          buttons: [
            btn(enabled ? 'autoreact_off' : 'autoreact_on', enabled ? '❌ Turn OFF' : '✅ Turn ON'),
            btn('ownermenu', '👑 Owner Menu'),
            urlBtn('🌐 Website', CHANNEL_URL),
          ],
        }, { quoted: msg });
      }

      const opt = args.join(' ').toLowerCase();

      if (opt === 'on') {
        await database.updateGlobalSettings({ autoReact: true });
        return sendBtn(sock, extra.from, { text: `✅ *Auto-React ON*`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg });
      }
      if (opt === 'off') {
        await database.updateGlobalSettings({ autoReact: false });
        return sendBtn(sock, extra.from, { text: `❌ *Auto-React OFF*`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg });
      }
      if (opt === 'set bot') {
        await database.updateGlobalSettings({ autoReactMode: 'cmd-only' });
        return sendBtn(sock, extra.from, { text: `🤖 *Mode → Bot commands only*\n\n_Will only react with ⏳ when a command is sent._`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg });
      }
      if (opt === 'set all') {
        await database.updateGlobalSettings({ autoReactMode: 'all' });
        return sendBtn(sock, extra.from, { text: `🌟 *Mode → All messages*\n\n_Will react with a random emoji to every message._`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg });
      }

      extra.reply('❌ Invalid option.\n\nUsage:\n`.autoreact on` — enable\n`.autoreact off` — disable\n`.autoreact set bot` — commands only\n`.autoreact set all` — all messages');
    } catch (err) {
      console.error('[autoreact cmd] error:', err);
      extra.reply('❌ Error configuring auto-react.');
    }
  }
};
