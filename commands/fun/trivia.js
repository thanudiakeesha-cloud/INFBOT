const axios = require('axios');

const activeTriviaGames = new Map();

module.exports = {
  name: 'trivia',
  aliases: ['quiz', 'triviaquest'],
  category: 'fun',
  description: 'Answer a random trivia question',
  usage: '.trivia [easy|medium|hard]',

  async execute(sock, msg, args, extra) {
    try {
      const difficulty = ['easy', 'medium', 'hard'].includes(args[0]?.toLowerCase()) ? args[0].toLowerCase() : 'medium';

      await extra.react('🧠');

      const response = await axios.get(`https://opentdb.com/api.php?amount=1&difficulty=${difficulty}&type=multiple`, { timeout: 15000 });

      if (!response.data?.results?.length) {
        return extra.reply('❌ Could not fetch trivia question. Try again later.');
      }

      const q = response.data.results[0];

      const decodeHtml = (html) => {
        return html
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&eacute;/g, 'é')
          .replace(/&ntilde;/g, 'ñ');
      };

      const question = decodeHtml(q.question);
      const correct = decodeHtml(q.correct_answer);
      const allAnswers = [...q.incorrect_answers.map(decodeHtml), correct].sort(() => Math.random() - 0.5);
      const correctIndex = allAnswers.indexOf(correct) + 1;

      const difficultyEmoji = { easy: '🟢', medium: '🟡', hard: '🔴' };
      const categoryClean = decodeHtml(q.category);

      const gameKey = `${extra.from}_${extra.sender}`;
      activeTriviaGames.set(gameKey, {
        correctIndex,
        correctAnswer: correct,
        timestamp: Date.now()
      });

      const text = `╭━━〔 🧠 TRIVIA 〕━━⬣
┃ ${difficultyEmoji[difficulty]} *Difficulty:* ${difficulty.toUpperCase()}
┃ 📂 *Category:* ${categoryClean}
┃
┃ ❓ *${question}*
┃
${allAnswers.map((a, i) => `┃ ${i + 1}. ${a}`).join('\n')}
╰━━━━━━━━━━━━━━━━━━━━⬣

Reply with the number (1-4) to answer!
_Answer expires in 30 seconds._

> *INFINITY MD*`;

      await extra.reply(text);

      setTimeout(() => {
        const game = activeTriviaGames.get(gameKey);
        if (game && Date.now() - game.timestamp < 35000) {
          activeTriviaGames.delete(gameKey);
        }
      }, 35000);

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  },

  checkAnswer(from, sender, body) {
    const gameKey = `${from}_${sender}`;
    const game = activeTriviaGames.get(gameKey);

    if (!game) return null;
    if (Date.now() - game.timestamp > 30000) {
      activeTriviaGames.delete(gameKey);
      return null;
    }

    const answer = parseInt(body);
    if (isNaN(answer) || answer < 1 || answer > 4) return null;

    activeTriviaGames.delete(gameKey);

    if (answer === game.correctIndex) {
      return `✅ *Correct!* The answer was: *${game.correctAnswer}*\n\n> *INFINITY MD*`;
    } else {
      return `❌ *Wrong!* The correct answer was: *${game.correctAnswer}*\n\n> *INFINITY MD*`;
    }
  }
};
