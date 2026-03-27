/**
 * AntiTag Command
 * Enable/disable anti-tag and set action (delete/kick)
 */

const database = require('../../database');
const { sendBtn, btn } = require('../../utils/sendBtn');

module.exports = {
  name: 'antitag',
  aliases: ['antimention', 'at'],
  description: 'Configure anti-tag protection (tagall/hidetag)',
  usage: '.antitag <on/off/set/get>',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,
  
  async execute(sock, msg, args, extra) {
    try {
      if (!args[0]) {
        const settings = database.getGroupSettings(extra.from);
        const status = settings.antitag ? '✅ ON' : '❌ OFF';
        const action = settings.antitagAction || 'delete';
        const text =
          `╭━━〔 📛 *ANTI-TAG* 〕━━⬣\n` +
          `┃\n` +
          `┃  🔒 *Status:* ${status}\n` +
          `┃  ⚙️ *Action:* ${action}\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━⬣`;
        return sendBtn(sock, extra.from, {
          text,
          footer: `♾️ Infinity MD • Tap to configure`,
          buttons: [
            btn(settings.antitag ? 'antitag_off' : 'antitag_on',
                settings.antitag ? '❌ Turn OFF' : '✅ Turn ON'),
            btn('antitag_delete', `🗑️ Action: Delete${action === 'delete' ? ' ✓' : ''}`),
            btn('antitag_kick', `🚫 Action: Kick${action === 'kick' ? ' ✓' : ''}`),
          ]
        }, { quoted: msg });
      }
      
      const opt = args[0].toLowerCase();
      
      if (opt === 'on') {
        if (database.getGroupSettings(extra.from).antitag) {
          return extra.reply('*Antitag is already on*');
        }
        database.updateGroupSettings(extra.from, { antitag: true });
        return extra.reply('*Antitag has been turned ON*');
      }
      
      if (opt === 'off') {
        database.updateGroupSettings(extra.from, { antitag: false });
        return extra.reply('*Antitag has been turned OFF*');
      }
      
      if (opt === 'set') {
        if (args.length < 2) {
          return extra.reply('*Please specify an action: .antitag set delete | kick*');
        }
        
        const setAction = args[1].toLowerCase();
        if (!['delete', 'kick'].includes(setAction)) {
          return extra.reply('*Invalid action. Choose delete or kick.*');
        }
        
        database.updateGroupSettings(extra.from, { 
          antitagAction: setAction,
          antitag: true // Auto-enable when setting action
        });
        return extra.reply(`*Antitag action set to ${setAction}*`);
      }
      
      if (opt === 'get') {
        const settings = database.getGroupSettings(extra.from);
        const status = settings.antitag ? 'ON' : 'OFF';
        const action = settings.antitagAction || 'delete';
        return extra.reply(`*Antitag Configuration:*\nStatus: ${status}\nAction: ${action}`);
      }
      
      return extra.reply('*Use .antitag for usage.*');
      
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
