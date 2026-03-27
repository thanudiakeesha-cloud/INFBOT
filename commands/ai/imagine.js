const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'imagine',
  aliases: ['imgai', 'generateimg', 'aiimage'],
  category: 'ai',
  description: 'Generate AI images from text prompts',
  usage: '.imagine <prompt>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply(`╭───〔 🎨 AI IMAGINE 〕───\n│ ❌ Usage: ${config.prefix}imagine <prompt>\n│ Example: ${config.prefix}imagine a sunset over mountains\n╰────────────────────`);
      }

      const prompt = args.join(' ');
      await extra.react('🎨');
      await extra.reply('🎨 Generating image... Please wait.');

      const result = await APIs.generateImage(prompt);

      if (result && result.data) {
        const chatId = msg.key.remoteJid;
        await sock.sendMessage(chatId, {
          image: { url: result.data },
          caption: `╭───〔 🎨 AI IMAGE 〕───\n│ 🖌️ *Prompt*: ${prompt}\n╰────────────────────\n\n> 💫 *INFINITY MD IMAGINE*`
        }, { quoted: msg });
      } else {
        await extra.reply('❌ Failed to generate image. Try a different prompt.');
      }
    } catch (error) {
      await extra.reply(`╭───〔 🎨 IMAGINE ERROR 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
    }
  }
};
