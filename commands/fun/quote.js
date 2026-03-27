const APIs = require('../../utils/api');

module.exports = {
  name: 'quote',
  aliases: ['quotes', 'motivate', 'inspire'],
  category: 'fun',
  description: 'Get a random inspirational quote',
  usage: '.quote',

  async execute(sock, msg, args, extra) {
    try {
      await extra.react('💬');

      const data = await APIs.getQuote();

      const text = `╭━━〔 💬 QUOTE 〕━━⬣
┃
┃ _"${data.content}"_
┃
┃ — *${data.author}*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      const fallbackQuotes = [
        { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
        { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
        { text: "Life is what happens when you're busy making other plans.", author: 'John Lennon' },
        { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
        { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
        { text: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
        { text: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' }
      ];
      const q = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];

      const text = `╭━━〔 💬 QUOTE 〕━━⬣
┃
┃ _"${q.text}"_
┃
┃ — *${q.author}*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    }
  }
};
