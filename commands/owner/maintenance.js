const database = require('../../database');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

module.exports = {
  name: 'maintenance',
  aliases: ['maint'],
  category: 'owner',
  description: 'Toggle maintenance mode on/off',
  usage: '.maintenance [on/off]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const isOn = globalSettings.maintenance;

      const navBtns = [
        btn('ownermenu', '👑 Owner Menu'),
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', CHANNEL_URL),
      ];

      if (!args[0]) {
        return sendBtn(sock, extra.from, {
          text:
            `╭━━〔 🔧 *MAINTENANCE MODE* 〕━━⬣\n` +
            `┃\n` +
            `┃  🔒 *Status:* ${isOn ? '🔧 ON' : '✅ OFF'}\n` +
            `┃  📝 ${isOn ? 'Only owner can use the bot' : 'Bot available for everyone'}\n` +
            `┃\n` +
            `┃  Usage: .maintenance on/off\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
          footer: `♾️ Infinity MD`,
          buttons: [
            btn(isOn ? 'settings_maintenance_off' : 'settings_maintenance_on',
                isOn ? '✅ Turn OFF' : '🔧 Turn ON'),
            btn('ownermenu', '👑 Owner Menu'),
            urlBtn('🌐 Website', CHANNEL_URL),
          ],
        }, { quoted: msg });
      }

      const value = args[0].toLowerCase();
      if (value !== 'on' && value !== 'off') return extra.reply('❌ Use: .maintenance on/off');

      const newValue = value === 'on';
      if (globalSettings.maintenance === newValue) {
        return sendBtn(sock, extra.from, { text: `🔧 Already *${value.toUpperCase()}*`, footer: `♾️ Infinity MD`, buttons: navBtns }, { quoted: msg });
      }

      await database.updateGlobalSettings({ maintenance: newValue });
      return sendBtn(sock, extra.from, {
        text: newValue ? `🔧 *Maintenance ON*\n\nOnly owner can use the bot now.` : `✅ *Maintenance OFF*\n\nBot is available for everyone.`,
        footer: `♾️ Infinity MD`, buttons: navBtns,
      }, { quoted: msg });

    } catch (error) {
      console.error('Maintenance command error:', error);
      await extra.reply('❌ Error toggling maintenance mode.');
    }
  }
};
