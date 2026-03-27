const activeGames = new Map();

const words = [
  { word: 'javascript', hint: 'A programming language' },
  { word: 'elephant', hint: 'A large animal with a trunk' },
  { word: 'computer', hint: 'An electronic device' },
  { word: 'rainbow', hint: 'Colorful arc in the sky' },
  { word: 'guitar', hint: 'A musical instrument' },
  { word: 'diamond', hint: 'A precious gemstone' },
  { word: 'volcano', hint: 'A mountain that erupts' },
  { word: 'penguin', hint: 'A flightless bird' },
  { word: 'dolphin', hint: 'A smart marine mammal' },
  { word: 'castle', hint: 'A medieval fortress' },
  { word: 'planet', hint: 'A celestial body' },
  { word: 'forest', hint: 'A large area of trees' },
  { word: 'garden', hint: 'Where flowers grow' },
  { word: 'bridge', hint: 'Structure over water' },
  { word: 'camera', hint: 'Takes photos' },
  { word: 'rocket', hint: 'Goes to space' },
  { word: 'pirate', hint: 'Sails the seas' },
  { word: 'wizard', hint: 'A magical person' },
  { word: 'dragon', hint: 'A mythical creature' },
  { word: 'knight', hint: 'A medieval warrior' },
  { word: 'puzzle', hint: 'A brain teaser' },
  { word: 'temple', hint: 'A place of worship' },
  { word: 'museum', hint: 'Houses artifacts' },
  { word: 'galaxy', hint: 'A system of stars' },
  { word: 'island', hint: 'Land surrounded by water' }
];

module.exports = {
  name: 'scramble',
  aliases: ['unscramble', 'wordscramble'],
  category: 'game',
  description: 'Unscramble the jumbled word',
  usage: '.scramble [answer]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (args.length && activeGames.has(gameKey)) {
        const game = activeGames.get(gameKey);
        const answer = args.join('').toLowerCase();

        activeGames.delete(gameKey);

        if (answer === game.word) {
          await extra.react('🎉');
          return extra.reply(`🎉 *Correct!* The word was *${game.word}*!\n\n> *KNIGHT BOT MD*`);
        } else {
          return extra.reply(`❌ *Wrong!* The word was *${game.word}*\n\n> *KNIGHT BOT MD*`);
        }
      }

      const item = words[Math.floor(Math.random() * words.length)];
      const scrambled = item.word.split('').sort(() => Math.random() - 0.5).join('');

      activeGames.set(gameKey, { word: item.word, timestamp: Date.now() });

      setTimeout(() => { activeGames.delete(gameKey); }, 60000);

      await extra.react('🔤');

      const text = `╭━━〔 🔤 WORD SCRAMBLE 〕━━⬣
┃
┃ 🔀 Scrambled: *${scrambled.toUpperCase()}*
┃ 💡 Hint: ${item.hint}
┃ 📏 Letters: ${item.word.length}
┃
┃ Reply with *.scramble <answer>*
┃ _Expires in 60 seconds_
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
