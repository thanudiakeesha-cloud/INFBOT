module.exports = {
  name: 'zodiac',
  aliases: ['horoscope', 'starsign'],
  category: 'fun',
  description: 'Get your zodiac sign reading',
  usage: '.zodiac <sign>',
  async execute(sock, msg, args, extra) {
    const signs = {
      aries: { emoji: '♈', dates: 'Mar 21 – Apr 19', element: 'Fire', trait: 'Bold, ambitious, passionate', today: ['Great energy today!', 'A perfect day to take risks.', 'Romance is in the air.', 'Focus on your goals.'] },
      taurus: { emoji: '♉', dates: 'Apr 20 – May 20', element: 'Earth', trait: 'Reliable, patient, practical', today: ['Financial luck favors you.', 'Trust your instincts.', 'A calm day ahead.', 'Someone special thinks of you.'] },
      gemini: { emoji: '♊', dates: 'May 21 – Jun 20', element: 'Air', trait: 'Curious, adaptable, witty', today: ['Great day for communication.', 'New ideas are coming.', 'Stay flexible today.', 'A friend brings good news.'] },
      cancer: { emoji: '♋', dates: 'Jun 21 – Jul 22', element: 'Water', trait: 'Intuitive, emotional, nurturing', today: ['Home life brings peace.', 'Trust your feelings.', 'A healing day is ahead.', 'Express your emotions.'] },
      leo: { emoji: '♌', dates: 'Jul 23 – Aug 22', element: 'Fire', trait: 'Creative, generous, cheerful', today: ['You shine bright today!', 'Leadership opportunities await.', 'Creativity flows freely.', 'Someone admires you.'] },
      virgo: { emoji: '♍', dates: 'Aug 23 – Sep 22', element: 'Earth', trait: 'Analytical, precise, helpful', today: ['Details matter today.', 'Organization brings rewards.', 'Health focus pays off.', 'A problem gets solved.'] },
      libra: { emoji: '♎', dates: 'Sep 23 – Oct 22', element: 'Air', trait: 'Diplomatic, fair, social', today: ['Balance is your power.', 'Relationships flourish today.', 'Beauty surrounds you.', 'Justice comes your way.'] },
      scorpio: { emoji: '♏', dates: 'Oct 23 – Nov 21', element: 'Water', trait: 'Passionate, powerful, mysterious', today: ['Your intuition is sharp.', 'Transformation is near.', 'Hidden truth is revealed.', 'Power is in your hands.'] },
      sagittarius: { emoji: '♐', dates: 'Nov 22 – Dec 21', element: 'Fire', trait: 'Adventurous, optimistic, honest', today: ['Adventure calls you.', 'Travel brings fortune.', 'Wisdom guides your path.', 'Laugh and enjoy life.'] },
      capricorn: { emoji: '♑', dates: 'Dec 22 – Jan 19', element: 'Earth', trait: 'Ambitious, disciplined, responsible', today: ['Hard work pays off.', 'Career progress today.', 'Stay persistent.', 'A goal is within reach.'] },
      aquarius: { emoji: '♒', dates: 'Jan 20 – Feb 18', element: 'Air', trait: 'Innovative, independent, humanitarian', today: ['Think outside the box.', 'Innovation sparks today.', 'A breakthrough is near.', 'Community brings joy.'] },
      pisces: { emoji: '♓', dates: 'Feb 19 – Mar 20', element: 'Water', trait: 'Compassionate, artistic, intuitive', today: ['Dreams hold messages.', 'Creativity peaks today.', 'Empathy is your gift.', 'Magic is real today.'] }
    };
    if (!args[0]) return extra.reply('♈ Usage: .zodiac <sign>\nSigns: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces');
    const s = signs[args[0].toLowerCase()];
    if (!s) return extra.reply('❌ Unknown sign. Try: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces');
    const reading = s.today[Math.floor(Math.random() * s.today.length)];
    await extra.reply(`${s.emoji} *${args[0].charAt(0).toUpperCase() + args[0].slice(1)} Reading*\n\n📅 *Dates:* ${s.dates}\n🌊 *Element:* ${s.element}\n✨ *Traits:* ${s.trait}\n\n🔮 *Today's Reading:*\n_${reading}_\n\n> 🌟 *Infinity MD Zodiac*`);
  }
};
