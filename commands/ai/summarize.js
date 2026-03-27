const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'summarize',
  aliases: ['summary', 'tldr'],
  category: 'ai',
  description: 'Summarize long text using AI',
  usage: '.summarize <text>',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ').trim();

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!text && quoted) {
        text = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      }

      if (!text) {
        return extra.reply(`╭───〔 📝 SUMMARIZE 〕───\n│ ❌ Usage: ${config.prefix}summarize <text>\n│ Or reply to a message with ${config.prefix}summarize\n╰────────────────────`);
      }

      await extra.react('📝');

      const prompt = `Summarize the following text concisely in a few bullet points:\n\n${text}`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 📝 SUMMARY 〕───\n│ 📄 *Original Length*: ${text.length} chars\n│\n│ 📋 *Summary*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD SUMMARIZE*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 📝 SUMMARIZE ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
