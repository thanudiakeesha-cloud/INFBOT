module.exports = {
  name: 'roulette',
  aliases: ['rlt', 'spin'],
  category: 'game',
  description: 'Play roulette - bet on a color or number',
  usage: '.roulette <red|black|green|number(0-36)>',

  async execute(sock, msg, args, extra) {
    try {
      if (!args.length) {
        return extra.reply(`╭━━〔 🎡 ROULETTE 〕━━⬣
┃
┃ Usage: .roulette <bet>
┃
┃ 🔴 .roulette red
┃ ⚫ .roulette black
┃ 🟢 .roulette green
┃ 🔢 .roulette <0-36>
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const result = Math.floor(Math.random() * 37);
      const resultColor = result === 0 ? 'green' : redNumbers.includes(result) ? 'red' : 'black';
      const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };

      const bet = args[0].toLowerCase();
      let betType, won;

      if (['red', 'black', 'green'].includes(bet)) {
        betType = `Color: ${colorEmoji[bet]} ${bet}`;
        won = bet === resultColor;
      } else {
        const num = parseInt(bet);
        if (isNaN(num) || num < 0 || num > 36) {
          return extra.reply('❌ Bet on red, black, green, or a number 0-36!');
        }
        betType = `Number: ${num}`;
        won = num === result;
      }

      const resultEmoji = won ? '🎉' : '😢';
      await extra.react(won ? '🎉' : '💔');

      const text = `╭━━〔 🎡 ROULETTE 〕━━⬣
┃
┃ 🎡 *The wheel spins...*
┃
┃ Result: ${colorEmoji[resultColor]} *${result}* (${resultColor})
┃ Your bet: ${betType}
┃
┃ ${resultEmoji} ${won ? '*You WIN!*' : '*You lose!*'}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
