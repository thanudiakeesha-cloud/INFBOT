const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'explain',
  aliases: ['eli5', 'simplify', 'define'],
  category: 'ai',
  description: 'Explain a concept in simple terms using AI',
  usage: '.explain <concept>',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ').trim();

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!text && quoted) {
        text = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      }

      if (!text) {
        return extra.reply(`╭───〔 🧠 EXPLAIN 〕───\n│ ❌ Usage: ${config.prefix}explain <concept>\n│ Example: ${config.prefix}explain quantum entanglement\n│ Or reply to a message with ${config.prefix}explain\n╰────────────────────`);
      }

      await extra.react('🧠');

      const prompt = `Explain the following concept in simple, easy-to-understand terms as if explaining to a 10-year-old. Use examples if helpful:\n\n${text}`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 🧠 EXPLANATION 〕───\n│ 📚 *Concept*: ${text}\n│\n│ 💡 *Simple Explanation*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD EXPLAIN*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 🧠 EXPLAIN ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
