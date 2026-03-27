module.exports = {
  name: 'rate',
  aliases: ['rating', 'ratethis'],
  category: 'fun',
  description: 'Rate anything from 1 to 10',
  usage: '.rate <thing>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .rate <thing>\n\nExample: .rate pizza');
      }

      const thing = args.join(' ');
      const rating = Math.floor(Math.random() * 10) + 1;
      const stars = '⭐'.repeat(rating) + '☆'.repeat(10 - rating);

      let comment = '';
      if (rating <= 2) comment = 'Absolutely terrible! 🤮';
      else if (rating <= 4) comment = 'Not great... 😬';
      else if (rating <= 6) comment = 'It\'s okay, I guess 🤷';
      else if (rating <= 8) comment = 'Pretty good! 😄';
      else if (rating === 9) comment = 'Amazing! 🔥';
      else comment = 'PERFECTION! 💯';

      await extra.react('⭐');

      const text = `╭━━〔 ⭐ RATE 〕━━⬣
┃
┃ 📝 *Rating:* ${thing}
┃
┃ ${stars}
┃ 📊 *Score:* ${rating}/10
┃
┃ 💬 ${comment}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
