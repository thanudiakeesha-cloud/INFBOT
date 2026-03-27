const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'poem',
  aliases: ['aipoem', 'writepoem', 'poetry'],
  category: 'ai',
  description: 'Generate a poem using AI',
  usage: '.poem <topic>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply(`╭───〔 🎭 AI POEM 〕───\n│ ❌ Usage: ${config.prefix}poem <topic>\n│ Example: ${config.prefix}poem the beauty of nature\n╰────────────────────`);
      }

      const topic = args.join(' ');
      await extra.react('🎭');
      await extra.reply('🎭 Composing your poem... Please wait.');

      const prompt = `Write a beautiful poem (about 8-12 lines) about: ${topic}`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 🎭 AI POEM 〕───\n│ 🌹 *Topic*: ${topic}\n│\n│ 📝 *Poem*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD POEM*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 🎭 POEM ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
