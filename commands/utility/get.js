const axios = require('axios');

module.exports = {
  command: 'get',
  aliases: ['fetch'],
  category: 'utility',
  description: 'Fetch content from a URL.',
  usage: '.get <url>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const url = args[0];

    if (!url) {
      return await sock.sendMessage(chatId, { text: '❌ Usage: .get <url>' }, { quoted: message });
    }

    try {
      const res = await axios.get(url);
      const data = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data);
      
      await sock.sendMessage(chatId, { text: data.slice(0, 4000) }, { quoted: message });
    } catch (e) {
      await sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: message });
    }
  }
};
