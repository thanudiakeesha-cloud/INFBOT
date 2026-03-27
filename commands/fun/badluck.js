module.exports = {
  name: 'badluck',
  aliases: ['unlucky', 'cursed'],
  category: 'fun',
  description: 'Check your bad luck level today',
  usage: '.badluck',
  async execute(sock, msg, args, extra) {
    const sender = msg.key.participant || msg.key.remoteJid || 'user';
    const seed = sender.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + new Date().getDate();
    const pct = seed % 101;
    const bars = Math.floor(pct / 10);
    const bar = '🔴'.repeat(bars) + '⚫'.repeat(10 - bars);
    let verdict;
    if (pct < 20) verdict = 'Almost no bad luck! Today is your day! 🍀';
    else if (pct < 40) verdict = 'Minor bad luck. Watch your step! 👀';
    else if (pct < 60) verdict = 'Moderate bad luck. Be careful! ⚠️';
    else if (pct < 80) verdict = 'High bad luck! Things might go wrong. 😬';
    else verdict = 'MAXIMUM BAD LUCK! Stay home! 💀';
    await extra.reply(`☠️ *Bad Luck Meter*\n\n${bar}\n📊 *Level:* ${pct}%\n\n💬 *${verdict}*\n\n> 🎲 *Infinity MD*`);
  }
};
