/**
 * AntiBadAI Command - Use AI to detect and delete bad words/profanity in group messages
 */

const database = require('../../database');

module.exports = {
  name: 'antibadai',
  aliases: ['antibad', 'antiswear', 'aibadword'],
  category: 'admin',
  description: 'Enable AI-powered bad word detection — automatically deletes messages containing profanity or offensive language',
  usage: '.antibadai <on/off/status>',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const settings = database.getGroupSettings(extra.from);

      if (!args[0]) {
        const status = settings.antibadai ? '✅ ON' : '❌ OFF';
        return extra.reply(
          `╭━━〔 🤖 *ANTI-BAD AI* 〕━━⬣\n` +
          `┃\n` +
          `┃  📊 *Status:* ${status}\n` +
          `┃\n` +
          `┃  When enabled, every message is\n` +
          `┃  checked by AI for bad words,\n` +
          `┃  profanity, and offensive language.\n` +
          `┃  Offending messages are auto-deleted.\n` +
          `┃\n` +
          `┃  Usage:\n` +
          `┃  • .antibadai on\n` +
          `┃  • .antibadai off\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━⬣`
        );
      }

      const opt = args[0].toLowerCase();

      if (opt === 'on') {
        if (settings.antibadai) return extra.reply('🤖 *AntiBadAI is already ON*');
        database.updateGroupSettings(extra.from, { antibadai: true });
        return extra.reply(
          `╭━━〔 🤖 *ANTI-BAD AI* 〕━━⬣\n` +
          `┃\n` +
          `┃  ✅ *AntiBadAI has been turned ON*\n` +
          `┃\n` +
          `┃  All messages will now be scanned\n` +
          `┃  by AI for bad words and profanity.\n` +
          `┃  Violations will be auto-deleted.\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━⬣`
        );
      }

      if (opt === 'off') {
        if (!settings.antibadai) return extra.reply('🤖 *AntiBadAI is already OFF*');
        database.updateGroupSettings(extra.from, { antibadai: false });
        return extra.reply('❌ *AntiBadAI has been turned OFF*');
      }

      if (opt === 'status') {
        const status = settings.antibadai ? '✅ ON' : '❌ OFF';
        return extra.reply(`🤖 *AntiBadAI Status:* ${status}`);
      }

      return extra.reply('❌ Invalid option!\nUsage: .antibadai <on/off/status>');
    } catch (error) {
      console.error('[AntiBadAI Command Error]:', error);
      return extra.reply('❌ Error updating AntiBadAI setting.');
    }
  }
};
