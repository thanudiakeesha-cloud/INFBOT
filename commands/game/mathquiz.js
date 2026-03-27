const activeGames = new Map();

module.exports = {
  name: 'mathquiz',
  aliases: ['math', 'mq', 'mathgame'],
  category: 'game',
  description: 'Solve random math problems',
  usage: '.mathquiz [answer]',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (args.length && activeGames.has(gameKey)) {
        const game = activeGames.get(gameKey);
        const answer = parseFloat(args[0]);

        if (isNaN(answer)) {
          return extra.reply('❌ Please provide a number as your answer!');
        }

        activeGames.delete(gameKey);

        if (Math.abs(answer - game.answer) < 0.01) {
          await extra.react('✅');
          return extra.reply(`✅ *Correct!* ${game.problem} = *${game.answer}*\n\n> *KNIGHT BOT MD*`);
        } else {
          await extra.react('❌');
          return extra.reply(`❌ *Wrong!* ${game.problem} = *${game.answer}*\n\n> *KNIGHT BOT MD*`);
        }
      }

      const ops = ['+', '-', '×', '÷'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let a, b, answer, problem;

      switch (op) {
        case '+':
          a = Math.floor(Math.random() * 100) + 1;
          b = Math.floor(Math.random() * 100) + 1;
          answer = a + b;
          problem = `${a} + ${b}`;
          break;
        case '-':
          a = Math.floor(Math.random() * 100) + 1;
          b = Math.floor(Math.random() * a) + 1;
          answer = a - b;
          problem = `${a} - ${b}`;
          break;
        case '×':
          a = Math.floor(Math.random() * 12) + 1;
          b = Math.floor(Math.random() * 12) + 1;
          answer = a * b;
          problem = `${a} × ${b}`;
          break;
        case '÷':
          b = Math.floor(Math.random() * 12) + 1;
          answer = Math.floor(Math.random() * 12) + 1;
          a = b * answer;
          problem = `${a} ÷ ${b}`;
          break;
      }

      activeGames.set(gameKey, { problem, answer, timestamp: Date.now() });

      setTimeout(() => { activeGames.delete(gameKey); }, 30000);

      await extra.react('🔢');

      const text = `╭━━〔 🔢 MATH QUIZ 〕━━⬣
┃
┃ 🧮 *Solve this:*
┃
┃ *${problem} = ?*
┃
┃ Reply with *.mathquiz <answer>*
┃ _Expires in 30 seconds_
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
