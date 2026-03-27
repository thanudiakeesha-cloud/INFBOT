module.exports = {
  name: 'fortune',
  aliases: ['cookie', 'luckymsg'],
  category: 'fun',
  description: 'Get a fortune cookie message',
  usage: '.fortune',
  async execute(sock, msg, args, extra) {
    const fortunes = [
      "A dream you have will come true.",
      "Your future is filled with promise and potential.",
      "Hard work pays off in the future. Laziness pays off now.",
      "The best time to plant a tree was 20 years ago. The second best time is now.",
      "A small act of kindness can change someone's day.",
      "Adventure awaits those who dare to seek it.",
      "Your creativity will lead you to unexpected places.",
      "Success is not final, failure is not fatal. It is the courage to continue that counts.",
      "A pleasant surprise is waiting for you.",
      "You will find happiness in unexpected places.",
      "The stars align in your favor today.",
      "Patience is your greatest weapon right now.",
      "You will soon make a great discovery.",
      "Today is a good day to start something new.",
      "Kindness is a language everyone understands.",
      "The one who tries cannot fail forever.",
      "Your smile is your best accessory.",
      "A new friendship will bring you joy.",
      "The universe has great plans for you.",
      "Your talents are needed by the world.",
    ];
    const lucky = Math.floor(Math.random() * 99) + 1;
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    await extra.reply(`🥠 *Fortune Cookie*\n\n_"${fortune}"_\n\n🍀 *Lucky Numbers:* ${lucky}, ${lucky+7}, ${lucky+14}, ${lucky+3}`);
  }
};
