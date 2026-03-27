const activeGames = new Map();

module.exports = {
  name: 'guess',
  aliases: ['guessnumber', 'numguess'],
  category: 'game',
  description: 'Guess the number between 1 and 100',
  usage: '.guess [number]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (!args.length || !activeGames.has(gameKey)) {
        if (!args.length) {
          const secret = Math.floor(Math.random() * 100) + 1;
          activeGames.set(gameKey, { secret, attempts: 0, timestamp: Date.now() });

          setTimeout(() => { activeGames.delete(gameKey); }, 120000);

          const text = `╭━━〔 🔢 GUESS THE NUMBER 〕━━⬣
┃
┃ I'm thinking of a number between *1* and *100*
┃ You have *10* attempts to guess it!
┃
┃ Use *.guess <number>* to make a guess
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

          return extra.reply(text);
        }
      }

      const game = activeGames.get(gameKey);
      if (!game) {
        return extra.reply('❌ No active game! Start one with .guess');
      }

      const num = parseInt(args[0]);
      if (isNaN(num) || num < 1 || num > 100) {
        return extra.reply('❌ Please guess a number between 1 and 100!');
      }

      game.attempts++;

      if (num === game.secret) {
        activeGames.delete(gameKey);
        await extra.react('🎉');
        return extra.reply(`╭━━〔 🔢 GUESS THE NUMBER 〕━━⬣
┃
┃ 🎉 *Correct!* The number was *${game.secret}*!
┃ You got it in *${game.attempts}* attempt(s)!
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      if (game.attempts >= 10) {
        activeGames.delete(gameKey);
        return extra.reply(`╭━━〔 🔢 GUESS THE NUMBER 〕━━⬣
┃
┃ 😢 *Game Over!* The number was *${game.secret}*
┃ You used all 10 attempts!
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const hint = num < game.secret ? '📈 *Too low!*' : '📉 *Too high!*';
      const remaining = 10 - game.attempts;

      await extra.reply(`╭━━〔 🔢 GUESS THE NUMBER 〕━━⬣
┃
┃ ${hint} Try again!
┃ Attempts remaining: *${remaining}*
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
