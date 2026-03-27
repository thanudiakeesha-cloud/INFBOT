module.exports = {
  name: 'clap',
  aliases: ['clapback'],
  category: 'fun',
  description: 'Add clap emoji between words',
  usage: '.clap <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .clap <text>\n\nExample: .clap this is important');
      }

      const clapped = args.join(' ').split(' ').join(' 👏 ');

      await extra.react('👏');

      const result = `╭━━〔 👏 CLAP TEXT 〕━━⬣
┃
┃ ${clapped} 👏
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(result);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
