module.exports = {
  name: '8ball',
  aliases: ['eightball', 'magic8ball', 'ask'],
  category: 'fun',
  description: 'Ask the magic 8-ball a yes/no question',
  usage: '.8ball <question>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .8ball <question>\n\nExample: .8ball Will I be rich?');
      }

      const question = args.join(' ');

      const answers = [
        { text: 'It is certain.', emoji: '🟢' },
        { text: 'It is decidedly so.', emoji: '🟢' },
        { text: 'Without a doubt.', emoji: '🟢' },
        { text: 'Yes, definitely.', emoji: '🟢' },
        { text: 'You may rely on it.', emoji: '🟢' },
        { text: 'As I see it, yes.', emoji: '🟢' },
        { text: 'Most likely.', emoji: '🟢' },
        { text: 'Outlook good.', emoji: '🟢' },
        { text: 'Yes.', emoji: '🟢' },
        { text: 'Signs point to yes.', emoji: '🟢' },
        { text: 'Reply hazy, try again.', emoji: '🟡' },
        { text: 'Ask again later.', emoji: '🟡' },
        { text: 'Better not tell you now.', emoji: '🟡' },
        { text: 'Cannot predict now.', emoji: '🟡' },
        { text: 'Concentrate and ask again.', emoji: '🟡' },
        { text: "Don't count on it.", emoji: '🔴' },
        { text: 'My reply is no.', emoji: '🔴' },
        { text: 'My sources say no.', emoji: '🔴' },
        { text: 'Outlook not so good.', emoji: '🔴' },
        { text: 'Very doubtful.', emoji: '🔴' }
      ];

      const answer = answers[Math.floor(Math.random() * answers.length)];

      await extra.react('🎱');

      const text = `╭━━〔 🎱 MAGIC 8-BALL 〕━━⬣
┃
┃ ❓ *Question:* ${question}
┃
┃ ${answer.emoji} *Answer:* ${answer.text}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
