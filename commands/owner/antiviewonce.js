const database = require('../../database');
const config = require('../../config');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

module.exports = {
  name: 'antiviewonce',
  aliases: ['antivo', 'viewonceguard'],
  description: 'Toggle anti-viewonce — intercepts view-once media and saves it to owner chat',
  usage: '.antiviewonce [on/off]',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const sessionSettings = sock._customConfig?.settings || {};
      const effectiveSettings = { ...globalSettings, ...sessionSettings };
      const current = effectiveSettings.antiviewonce || false;
      const ownerNum = (sock._customConfig?.ownerNumber || config.ownerNumber[0] || '').replace(/[^0-9]/g, '');

      const navBtns = [
        btn('ownermenu', '👑 Owner Menu'),
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', CHANNEL_URL),
      ];

      if (!args[0]) {
        return sendBtn(sock, extra.from, {
          text:
            `╭━━〔 👁️ *ANTI-VIEWONCE* 〕━━⬣\n` +
            `┃\n` +
            `┃  🔒 *Status:* ${current ? '✅ ON' : '❌ OFF'}\n` +
            `┃  👤 *Owner:* +${ownerNum}\n` +
            `┃\n` +
            `┃  📌 When ON, view-once media is\n` +
            `┃  silently forwarded to your chat.\n` +
            `┃\n` +
            `┃  Usage: .antiviewonce on/off\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
          footer: `♾️ Infinity MD`,
          buttons: [
            btn(current ? 'settings_antiviewonce_off' : 'settings_antiviewonce_on',
                current ? '❌ Turn OFF' : '✅ Turn ON'),
            btn('ownermenu', '👑 Owner Menu'),
            urlBtn('🌐 Website', CHANNEL_URL),
          ],
        }, { quoted: msg });
      }

      const value = args[0].toLowerCase();
      if (value !== 'on' && value !== 'off') return extra.reply('❌ Invalid option!\nUsage: .antiviewonce on/off');

      const newValue = value === 'on';
      if (newValue === current) {
        return sendBtn(sock, extra.from, {
          text: `👁️ Anti-ViewOnce is already *${value.toUpperCase()}*`,
          footer: `♾️ Infinity MD`, buttons: navBtns,
        }, { quoted: msg });
      }

      await database.updateGlobalSettings({ antiviewonce: newValue });
      return sendBtn(sock, extra.from, {
        text: newValue
          ? `✅ *Anti-ViewOnce ON*\n\n👁️ View-once media will be secretly saved to your chat (+${ownerNum}).`
          : `❌ *Anti-ViewOnce OFF*\n\nView-once media is no longer intercepted.`,
        footer: `♾️ Infinity MD`, buttons: navBtns,
      }, { quoted: msg });

    } catch (error) {
      console.error('AntiViewOnce command error:', error);
      await extra.reply('❌ Error toggling anti-viewonce.');
    }
  }
};
