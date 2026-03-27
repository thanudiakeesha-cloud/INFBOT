module.exports = {
  name: 'wyr',
  aliases: ['wouldurather', 'rather'],
  category: 'fun',
  description: 'Play Would You Rather',
  usage: '.wyr',
  async execute(sock, msg, args, extra) {
    const questions = [
      ['Be able to fly', 'Be invisible'],
      ['Always speak your mind', 'Never speak again'],
      ['Have super strength', 'Have super speed'],
      ['Live in the past', 'Live in the future'],
      ['Be incredibly smart', 'Be incredibly lucky'],
      ['Never need to sleep', 'Never need to eat'],
      ['Have a pause button for life', 'Have a rewind button for life'],
      ['Know how you will die', 'Know when you will die'],
      ['Be famous', 'Be powerful'],
      ['Always be 10 minutes late', 'Always be 20 minutes early'],
      ['Give up social media', 'Give up music'],
      ['Have no internet', 'Have no mobile phone'],
      ['Be a wizard', 'Be a superhero'],
      ['Live without music', 'Live without TV'],
      ['Be the funniest person in the room', 'Be the smartest person in the room'],
    ];
    const q = questions[Math.floor(Math.random() * questions.length)];
    await extra.reply(`🤔 *Would You Rather?*\n\n🅰️ ${q[0]}\n\n               *OR*\n\n🅱️ ${q[1]}\n\n> Reply with 🅰️ or 🅱️!\n> 🎮 *Infinity MD*`);
  }
};
