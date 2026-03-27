const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'code',
  aliases: ['codehelp', 'coder', 'programming'],
  category: 'ai',
  description: 'Get coding help from AI',
  usage: '.code <question>',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ').trim();

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!text && quoted) {
        text = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      }

      if (!text) {
        return extra.reply(`╭───〔 💻 CODE HELPER 〕───\n│ ❌ Usage: ${config.prefix}code <question>\n│ Example: ${config.prefix}code how to reverse a string in python\n│ Or reply to code with ${config.prefix}code explain this\n╰────────────────────`);
      }

      await extra.react('💻');
      await extra.reply('💻 Processing your code query...');

      const prompt = `You are a coding assistant. Help with the following programming question. Provide clear code examples with explanations:\n\n${text}`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 💻 CODE HELPER 〕───\n│ 🔧 *Query*: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n│\n│ 📋 *Solution*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD CODE*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 💻 CODE ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
