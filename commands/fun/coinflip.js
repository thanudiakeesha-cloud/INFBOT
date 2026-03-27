module.exports = {
  name: 'coinflip',
  aliases: ['flip', 'coin', 'cf'],
  category: 'fun',
  description: 'Flip a coin - heads or tails',
  usage: '.coinflip [guess]',

  async execute(sock, msg, args, extra) {
    try {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const emoji = result === 'Heads' ? '🪙' : '💰';

      await extra.react('🪙');

      let guessResult = '';
      if (args.length > 0) {
        const guess = args[0].toLowerCase();
        if (guess === 'heads' || guess === 'h' || guess === 'tails' || guess === 't') {
          const guessNormalized = (guess === 'h' || guess === 'heads') ? 'Heads' : 'Tails';
          const won = guessNormalized === result;
          guessResult = `\n┃\n┃ 🎯 *Your guess:* ${guessNormalized}\n┃ ${won ? '✅ You guessed correctly!' : '❌ Wrong guess!'}`;
        }
      }

      const text = `╭━━〔 ${emoji} COIN FLIP 〕━━⬣
┃
┃ *The coin lands on...*
┃
┃ ${emoji} *${result}!*${guessResult}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
