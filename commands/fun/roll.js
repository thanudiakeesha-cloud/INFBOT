module.exports = {
  name: 'roll',
  aliases: ['dice', 'rolldice'],
  category: 'fun',
  description: 'Roll dice with customizable sides and count',
  usage: '.roll [count]d[sides]\nExamples: .roll, .roll 2d6, .roll d20',

  async execute(sock, msg, args, extra) {
    try {
      let count = 1;
      let sides = 6;

      if (args.length > 0) {
        const input = args[0].toLowerCase();
        const match = input.match(/^(\d*)d(\d+)$/);
        if (match) {
          count = match[1] ? parseInt(match[1]) : 1;
          sides = parseInt(match[2]);
        } else if (/^\d+$/.test(input)) {
          sides = parseInt(input);
        }
      }

      if (count < 1 || count > 20) {
        return extra.reply('❌ You can roll between 1 and 20 dice.');
      }
      if (sides < 2 || sides > 1000) {
        return extra.reply('❌ Dice must have between 2 and 1000 sides.');
      }

      const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const results = [];

      for (let i = 0; i < count; i++) {
        const value = Math.floor(Math.random() * sides) + 1;
        results.push(value);
      }

      const total = results.reduce((a, b) => a + b, 0);

      await extra.react('🎲');

      let resultDisplay = results.map((v, i) => {
        const emoji = sides === 6 && v <= 6 ? diceEmojis[v - 1] : '🎲';
        return `┃ ${emoji} Die ${i + 1}: *${v}*`;
      }).join('\n');

      const text = `╭━━〔 🎲 DICE ROLL 〕━━⬣
┃ Rolling ${count}d${sides}...
┃
${resultDisplay}
┃
┃ 📊 *Total: ${total}*${count > 1 ? `\n┃ 📈 *Average: ${(total / count).toFixed(1)}*` : ''}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
