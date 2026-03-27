const config = require('../../config');

module.exports = {
  name: 'owner',
  aliases: ['dev'],
  category: 'general',
  description: 'Get owner info',
  usage: '.owner',
  
  async execute(sock, msg, args, extra) {
    const ownerText = `╭───〔 👑 OWNER INFO 〕───
│ 👤 *Name* : ${config.ownerName[0]}
│ 📱 *Number* : ${config.ownerNumber[0]}
│ 🌐 *Github* : ${config.social.github}
╰────────────────────

> 💫 *INFINITY MD* - Powered by AI`;
    await extra.reply(ownerText);
  }
};
