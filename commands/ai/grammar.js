const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'grammar',
  aliases: ['grammarcheck', 'fixgrammar', 'proofread'],
  category: 'ai',
  description: 'Check and fix grammar using AI',
  usage: '.grammar <text>',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ').trim();

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!text && quoted) {
        text = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      }

      if (!text) {
        return extra.reply(`╭───〔 ✏️ GRAMMAR CHECK 〕───\n│ ❌ Usage: ${config.prefix}grammar <text>\n│ Or reply to a message with ${config.prefix}grammar\n╰────────────────────`);
      }

      await extra.react('✏️');

      const prompt = `Check the following text for grammar and spelling errors. Provide the corrected version and list the corrections made:\n\n"${text}"`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 ✏️ GRAMMAR CHECK 〕───\n│ 📝 *Original*: ${text}\n│\n│ ✅ *Corrected*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD GRAMMAR*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 ✏️ GRAMMAR ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
