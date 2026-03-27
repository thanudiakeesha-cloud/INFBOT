const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'story',
  aliases: ['aistory', 'writestory', 'tale'],
  category: 'ai',
  description: 'Generate a creative story using AI',
  usage: '.story <topic/prompt>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply(`╭───〔 📖 AI STORY 〕───\n│ ❌ Usage: ${config.prefix}story <topic>\n│ Example: ${config.prefix}story a dragon and a brave knight\n╰────────────────────`);
      }

      const topic = args.join(' ');
      await extra.react('📖');
      await extra.reply('📖 Writing your story... Please wait.');

      const prompt = `Write a short creative story (about 200 words) about: ${topic}`;
      const response = await APIs.chatAI(prompt);
      const answer = response.response || response.msg || response.data?.msg || response;

      const result = `╭───〔 📖 AI STORY 〕───\n│ 🎭 *Topic*: ${topic}\n│\n│ 📜 *Story*:\n│ ${answer}\n╰────────────────────\n\n> 💫 *INFINITY MD STORY*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`╭───〔 📖 STORY ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
