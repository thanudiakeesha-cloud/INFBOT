const database = require('../../database');

module.exports = {
  name: 'statussave',
  aliases: ['ss', 'stsave'],
  description: 'Toggle react-to-save for statuses (any emoji or heart only)',
  usage: '.statussave <on|off|heart>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, { from, reply }) {
    const chatId = msg.key.remoteJid;

    try {
      const settings = database.getGlobalSettingsSync();
      const current = settings.statusSave || false;
      const action = args[0]?.toLowerCase();

      const modeLabel = (v) => {
        if (!v || v === false) return '❌ OFF';
        if (v === 'heart') return '❤️ Heart Only';
        return '✅ ON (Any emoji)';
      };

      if (!action) {
        return sock.sendMessage(chatId, {
          text:
            `╭━━〔 📸 *STATUS SAVE* 〕━━⬣\n` +
            `┃\n` +
            `┃  🔒 *Mode:* ${modeLabel(current)}\n` +
            `┃\n` +
            `┃  *Modes:*\n` +
            `┃  • *.statussave on* — any emoji saves\n` +
            `┃  • *.statussave heart* — ❤️ only\n` +
            `┃  • *.statussave off* — disabled\n` +
            `┃\n` +
            `┃  📌 *.save* always works (reply to status)\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
            `> 💫 *Infinity MD*`
        }, { quoted: msg });
      }

      if (action === 'on' || action === 'enable') {
        await database.updateGlobalSettings({ statusSave: 'on' });
        return sock.sendMessage(chatId, {
          text:
            `✅ *Status Save ON — Any Emoji*\n\n` +
            `React to any status with *any emoji* and it will be saved to your DM automatically.\n\n` +
            `> 💫 *Infinity MD*`
        }, { quoted: msg });

      } else if (action === 'heart') {
        await database.updateGlobalSettings({ statusSave: 'heart' });
        return sock.sendMessage(chatId, {
          text:
            `❤️ *Status Save ON — Heart Only*\n\n` +
            `React to a status with a *❤️ heart* to save it to your DM. Other emojis will be ignored.\n\n` +
            `> 💫 *Infinity MD*`
        }, { quoted: msg });

      } else if (action === 'off' || action === 'disable') {
        await database.updateGlobalSettings({ statusSave: false });
        return sock.sendMessage(chatId, {
          text: `❌ *Status Save OFF*\n\nReact-to-save is disabled. You can still use *.save* manually.\n\n> 💫 *Infinity MD*`
        }, { quoted: msg });

      } else {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid option.\n\nUse: *.statussave on* | *.statussave heart* | *.statussave off*'
        }, { quoted: msg });
      }

    } catch (error) {
      console.error('[StatusSave] Command error:', error.message);
      reply('❌ Error processing command.');
    }
  }
};
