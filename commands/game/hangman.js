const activeGames = new Map();

const words = [
  'javascript', 'python', 'computer', 'programming', 'algorithm',
  'database', 'network', 'internet', 'software', 'hardware',
  'keyboard', 'monitor', 'function', 'variable', 'elephant',
  'rainbow', 'diamond', 'volcano', 'penguin', 'dolphin',
  'guitar', 'planet', 'forest', 'castle', 'garden',
  'bridge', 'camera', 'rocket', 'pirate', 'wizard',
  'dragon', 'knight', 'puzzle', 'temple', 'museum',
  'galaxy', 'ocean', 'mountain', 'island', 'desert'
];

const stages = [
  '```\n  +---+\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
];

module.exports = {
  name: 'hangman',
  aliases: ['hm', 'hang'],
  category: 'game',
  description: 'Play Hangman word guessing game',
  usage: '.hangman [letter]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (!args.length && !activeGames.has(gameKey)) {
        const word = words[Math.floor(Math.random() * words.length)];
        activeGames.set(gameKey, {
          word,
          guessed: [],
          wrong: 0,
          timestamp: Date.now()
        });

        setTimeout(() => { activeGames.delete(gameKey); }, 180000);

        const display = word.split('').map(() => '_').join(' ');
        return extra.reply(`╭━━〔 🪢 HANGMAN 〕━━⬣
┃
${stages[0]}
┃ Word: ${display}
┃ Letters: ${word.length}
┃
┃ Guess a letter with *.hangman <letter>*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const game = activeGames.get(gameKey);
      if (!game) {
        return extra.reply('❌ No active game! Start one with .hangman');
      }

      const letter = args[0]?.toLowerCase();
      if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
        return extra.reply('❌ Please guess a single letter (a-z)!');
      }

      if (game.guessed.includes(letter)) {
        return extra.reply(`❌ You already guessed *${letter}*! Try another.`);
      }

      game.guessed.push(letter);

      if (!game.word.includes(letter)) {
        game.wrong++;
      }

      const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
      const won = !display.includes('_');
      const lost = game.wrong >= 6;

      if (won) {
        activeGames.delete(gameKey);
        await extra.react('🎉');
        return extra.reply(`╭━━〔 🪢 HANGMAN 〕━━⬣
┃
${stages[game.wrong]}
┃ Word: ${game.word}
┃
┃ 🎉 *You win!*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      if (lost) {
        activeGames.delete(gameKey);
        return extra.reply(`╭━━〔 🪢 HANGMAN 〕━━⬣
┃
${stages[6]}
┃ Word: ${game.word}
┃
┃ 😢 *Game Over!*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      await extra.reply(`╭━━〔 🪢 HANGMAN 〕━━⬣
┃
${stages[game.wrong]}
┃ Word: ${display}
┃ Guessed: ${game.guessed.join(', ')}
┃ Wrong: ${game.wrong}/6
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
