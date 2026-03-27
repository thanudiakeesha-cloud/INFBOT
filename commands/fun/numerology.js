module.exports = {
  name: 'numerology',
  aliases: ['lifepath', 'lifenumber'],
  category: 'fun',
  description: 'Calculate your numerology life path number',
  usage: '.numerology <DD/MM/YYYY>',
  async execute(sock, msg, args, extra) {
    if (!args[0]) return extra.reply('🔢 Usage: .numerology <DD/MM/YYYY>');
    const parts = args[0].split('/');
    if (parts.length !== 3) return extra.reply('❌ Format: DD/MM/YYYY');
    const digits = args[0].replace(/\//g, '').split('').map(Number);
    if (digits.some(isNaN)) return extra.reply('❌ Invalid date');
    let sum = digits.reduce((a, b) => a + b, 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = String(sum).split('').map(Number).reduce((a, b) => a + b, 0);
    }
    const meanings = {
      1: 'The Leader – Independent, ambitious, original.',
      2: 'The Mediator – Cooperative, sensitive, peaceful.',
      3: 'The Communicator – Creative, expressive, joyful.',
      4: 'The Builder – Practical, disciplined, reliable.',
      5: 'The Freedom Seeker – Adventurous, dynamic, versatile.',
      6: 'The Nurturer – Caring, responsible, harmonious.',
      7: 'The Seeker – Analytical, spiritual, wise.',
      8: 'The Powerhouse – Ambitious, business-minded, strong.',
      9: 'The Humanitarian – Compassionate, generous, idealistic.',
      11: 'Master Number – Highly intuitive, spiritual, inspiring.',
      22: 'Master Builder – Visionary, capable of great achievements.',
      33: 'Master Teacher – Compassionate leader, uplifting others.',
    };
    await extra.reply(`🔢 *Numerology Reading*\n\n📅 *Date:* ${args[0]}\n✨ *Life Path Number:* ${sum}\n\n📖 *Meaning:*\n${meanings[sum] || 'Unique path!'}\n\n> 🌙 *Infinity MD*`);
  }
};
