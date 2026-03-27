module.exports = {
  name: 'rps',
  aliases: ['rockpaperscissors'],
  category: 'fun',
  description: 'Play Rock Paper Scissors against the bot',
  usage: '.rps <rock|paper|scissors>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .rps <rock|paper|scissors>\n\nAliases: r, p, s\nExample: .rps rock');
      }

      const choices = {
        rock: '🪨', r: '🪨',
        paper: '📄', p: '📄',
        scissors: '✂️', s: '✂️'
      };

      const normalizeMap = {
        rock: 'rock', r: 'rock',
        paper: 'paper', p: 'paper',
        scissors: 'scissors', s: 'scissors'
      };

      const input = args[0].toLowerCase();
      const playerChoice = normalizeMap[input];

      if (!playerChoice) {
        return extra.reply('❌ Invalid choice! Use: rock, paper, or scissors (or r, p, s)');
      }

      const botOptions = ['rock', 'paper', 'scissors'];
      const botChoice = botOptions[Math.floor(Math.random() * 3)];

      let result;
      let resultEmoji;

      if (playerChoice === botChoice) {
        result = "It's a tie!";
        resultEmoji = '🤝';
      } else if (
        (playerChoice === 'rock' && botChoice === 'scissors') ||
        (playerChoice === 'paper' && botChoice === 'rock') ||
        (playerChoice === 'scissors' && botChoice === 'paper')
      ) {
        result = 'You win!';
        resultEmoji = '🎉';
      } else {
        result = 'You lose!';
        resultEmoji = '😢';
      }

      await extra.react(resultEmoji);

      const text = `╭━━〔 ✊ ROCK PAPER SCISSORS 〕━━⬣
┃
┃ 🧑 *You:* ${choices[playerChoice]} ${playerChoice.charAt(0).toUpperCase() + playerChoice.slice(1)}
┃ 🤖 *Bot:* ${choices[botChoice]} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}
┃
┃ ${resultEmoji} *${result}*
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
