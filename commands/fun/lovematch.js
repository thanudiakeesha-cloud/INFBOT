module.exports = {
  name: 'lovematch',
  aliases: ['compatibility', 'crush'],
  category: 'fun',
  description: 'Check love compatibility between two names',
  usage: '.lovematch <name1> & <name2>',
  async execute(sock, msg, args, extra) {
    if (args.length < 3) return extra.reply('💕 Usage: .lovematch <name1> & <name2>');
    const idx = args.indexOf('&');
    if (idx === -1) return extra.reply('💕 Usage: .lovematch <name1> & <name2>');
    const name1 = args.slice(0, idx).join(' ');
    const name2 = args.slice(idx + 1).join(' ');
    const seed = (name1 + name2).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const pct = (seed % 51) + 50;
    let hearts = '❤️'.repeat(Math.floor(pct / 20));
    let verdict = pct >= 90 ? 'Perfect Match! 💍' : pct >= 75 ? 'Strong Chemistry! 🔥' : pct >= 60 ? 'Good Compatibility 😊' : 'Needs Work 🤔';
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    await extra.reply(`💕 *Love Compatibility*\n\n👤 ${name1}\n💞 ${hearts}\n👤 ${name2}\n\n[${bar}] *${pct}%*\n\n💬 *Verdict:* ${verdict}\n\n> 🌹 *Infinity MD*`);
  }
};
