module.exports = {
  name: 'slots',
  aliases: ['slot', 'slotmachine', 'jackpot'],
  category: 'game',
  description: 'Try your luck on the slot machine',
  usage: '.slots',

  async execute(sock, msg, args, extra) {
    try {
      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
      const weights = [25, 20, 18, 15, 10, 7, 3, 2];

      function spin() {
        const total = weights.reduce((a, b) => a + b, 0);
        let rand = Math.floor(Math.random() * total);
        for (let i = 0; i < weights.length; i++) {
          rand -= weights[i];
          if (rand < 0) return symbols[i];
        }
        return symbols[0];
      }

      const r1 = spin(), r2 = spin(), r3 = spin();

      let result, emoji;
      if (r1 === r2 && r2 === r3) {
        if (r1 === '7️⃣') {
          result = '🎰 MEGA JACKPOT!!! 🎰';
          emoji = '💰';
        } else if (r1 === '💎') {
          result = '💎 DIAMOND JACKPOT! 💎';
          emoji = '💎';
        } else {
          result = '🎉 THREE OF A KIND! 🎉';
          emoji = '🎉';
        }
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        result = '✨ Two matching! Small win!';
        emoji = '✨';
      } else {
        result = '😢 No match. Try again!';
        emoji = '🎰';
      }

      await extra.react(emoji);

      const text = `╭━━〔 🎰 SLOT MACHINE 〕━━⬣
┃
┃ ┌──┬──┬──┐
┃ │${r1}│${r2}│${r3}│
┃ └──┴──┴──┘
┃
┃ ${result}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
