module.exports = {
  name: 'poll',
  aliases: ['vote', 'createpoll'],
  category: 'admin',
  description: 'Create a poll in group',
  usage: '.poll Question | Option1 | Option2 | ...',
  groupOnly: true,
  adminOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const text = args.join(' ');
      if (!text || !text.includes('|')) {
        return extra.reply('❌ Please provide a question and options separated by |\n\nExample: .poll Favorite color? | Red | Blue | Green');
      }

      const parts = text.split('|').map(p => p.trim()).filter(p => p.length > 0);

      if (parts.length < 3) {
        return extra.reply('❌ Please provide a question and at least 2 options!\n\nExample: .poll Favorite color? | Red | Blue | Green');
      }

      const question = parts[0];
      const options = parts.slice(1);

      if (options.length > 12) {
        return extra.reply('❌ Maximum 12 options allowed!');
      }

      await sock.sendMessage(extra.from, {
        poll: {
          name: question,
          values: options,
          selectableCount: 1
        }
      });

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
