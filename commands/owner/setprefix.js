const config = require('../../config');
const fs = require('fs');
const path = require('path');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

module.exports = {
  name: 'setprefix',
  aliases: ['prefix'],
  category: 'owner',
  description: 'Change bot command prefix',
  usage: '.setprefix <new prefix>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const navBtns = [
        btn('ownermenu', '👑 Owner Menu'),
        btn('menu', '🔙 Main Menu'),
        urlBtn('🌐 Website', CHANNEL_URL),
      ];

      if (args.length === 0) {
        return sendBtn(sock, extra.from, {
          text:
            `╭━━〔 ⌨️ *PREFIX* 〕━━⬣\n` +
            `┃\n` +
            `┃  📌 *Current:* ${config.prefix}\n` +
            `┃  Usage: .setprefix <new>\n` +
            `┃  Max 3 characters\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
          footer: `♾️ Infinity MD`, buttons: navBtns,
        }, { quoted: msg });
      }

      const newPrefix = args[0];
      if (newPrefix.length > 3) return extra.reply('❌ Prefix must be 1-3 characters!');

      config.prefix = newPrefix;
      const configPath = path.join(__dirname, '../../config.js');
      let configContent = fs.readFileSync(configPath, 'utf-8');
      configContent = configContent.replace(/prefix: '.*'/, `prefix: '${newPrefix}'`);
      fs.writeFileSync(configPath, configContent);

      return sendBtn(sock, extra.from, {
        text:
          `╭━━〔 ⌨️ *PREFIX UPDATED* 〕━━⬣\n` +
          `┃\n` +
          `┃  ✅ New prefix: *${newPrefix}*\n` +
          `┃  Example: ${newPrefix}menu\n` +
          `┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━⬣`,
        footer: `♾️ Infinity MD`, buttons: navBtns,
      }, { quoted: msg });

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
