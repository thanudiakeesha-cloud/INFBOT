const activeGames = new Map();

const wordList = [
  'apple', 'elephant', 'tiger', 'rabbit', 'table', 'eagle', 'engine',
  'energy', 'yellow', 'water', 'river', 'rain', 'night', 'tree',
  'earth', 'house', 'echo', 'orange', 'echo', 'olive', 'under',
  'robot', 'tower', 'radio', 'ocean', 'novel', 'light', 'train',
  'noise', 'error', 'roses', 'solar', 'round', 'dance', 'event'
];

module.exports = {
  name: 'wordchain',
  aliases: ['wc', 'chain', 'lastletter'],
  category: 'game',
  description: 'Word chain game - say a word starting with the last letter',
  usage: '.wordchain [word]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (!args.length && !activeGames.has(gameKey)) {
        const startWord = wordList[Math.floor(Math.random() * wordList.length)];
        const lastLetter = startWord[startWord.length - 1];
        activeGames.set(gameKey, {
          lastWord: startWord,
          lastLetter,
          usedWords: [startWord],
          score: 0,
          timestamp: Date.now()
        });

        setTimeout(() => { activeGames.delete(gameKey); }, 180000);

        return extra.reply(`╭━━〔 🔗 WORD CHAIN 〕━━⬣
┃
┃ Starting word: *${startWord}*
┃ Say a word starting with: *${lastLetter.toUpperCase()}*
┃
┃ Use *.wordchain <word>*
┃ Type *.wordchain stop* to end
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const game = activeGames.get(gameKey);
      if (!game) {
        return extra.reply('❌ No active game! Start one with .wordchain');
      }

      const word = args[0].toLowerCase();

      if (word === 'stop') {
        activeGames.delete(gameKey);
        return extra.reply(`╭━━〔 🔗 WORD CHAIN 〕━━⬣
┃
┃ 🏁 *Game Over!*
┃ Final Score: *${game.score}* words
┃ Words used: ${game.usedWords.join(' → ')}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      if (!/^[a-z]+$/.test(word)) {
        return extra.reply('❌ Use only letters (a-z)!');
      }

      if (word.length < 2) {
        return extra.reply('❌ Word must be at least 2 letters!');
      }

      if (word[0] !== game.lastLetter) {
        return extra.reply(`❌ Word must start with *${game.lastLetter.toUpperCase()}*!`);
      }

      if (game.usedWords.includes(word)) {
        return extra.reply('❌ That word was already used!');
      }

      game.score++;
      game.lastWord = word;
      game.lastLetter = word[word.length - 1];
      game.usedWords.push(word);

      const botWords = wordList.filter(w => w[0] === game.lastLetter && !game.usedWords.includes(w));

      if (botWords.length === 0) {
        activeGames.delete(gameKey);
        await extra.react('🎉');
        return extra.reply(`╭━━〔 🔗 WORD CHAIN 〕━━⬣
┃
┃ 🎉 *You win!* Bot can't think of a word!
┃ Final Score: *${game.score}*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
      }

      const botWord = botWords[Math.floor(Math.random() * botWords.length)];
      game.usedWords.push(botWord);
      game.lastWord = botWord;
      game.lastLetter = botWord[botWord.length - 1];

      await extra.reply(`╭━━〔 🔗 WORD CHAIN 〕━━⬣
┃
┃ ✅ Your word: *${word}*
┃ 🤖 Bot says: *${botWord}*
┃ Next letter: *${game.lastLetter.toUpperCase()}*
┃ Score: *${game.score}*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
