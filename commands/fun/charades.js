module.exports = {
  name: 'charades',
  aliases: ['act', 'mime'],
  category: 'fun',
  description: 'Get a charades word to act out',
  usage: '.charades',
  async execute(sock, msg, args, extra) {
    const words = [
      { word: 'Swimming', hint: 'activity in water' },
      { word: 'Cooking', hint: 'kitchen activity' },
      { word: 'Sleeping', hint: 'resting activity' },
      { word: 'Driving a car', hint: 'transportation' },
      { word: 'Playing guitar', hint: 'music' },
      { word: 'Taking a selfie', hint: 'photo activity' },
      { word: 'Eating spaghetti', hint: 'food activity' },
      { word: 'Walking a dog', hint: 'pet activity' },
      { word: 'Brushing teeth', hint: 'hygiene' },
      { word: 'Riding a bicycle', hint: 'transportation' },
      { word: 'Crying at a movie', hint: 'emotional activity' },
      { word: 'Sneezing', hint: 'body action' },
      { word: 'Dancing ballet', hint: 'dance style' },
      { word: 'Painting a wall', hint: 'home improvement' },
      { word: 'Texting on phone', hint: 'communication' },
    ];
    const w = words[Math.floor(Math.random() * words.length)];
    await extra.reply(`🎭 *Charades!*\n\nAct out: *${w.word}*\nHint: _${w.hint}_\n\nNo words, no sounds! Act it out!\n\n> 🎮 *Infinity MD*`);
  }
};
