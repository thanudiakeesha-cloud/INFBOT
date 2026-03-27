const activeQuizzes = new Map();

const questions = [
  { q: 'What is the capital of France?', options: ['London', 'Paris', 'Berlin', 'Madrid'], answer: 2 },
  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], answer: 3 },
  { q: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 4 },
  { q: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], answer: 3 },
  { q: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Fe', 'Cu'], answer: 2 },
  { q: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 3 },
  { q: 'What is the largest mammal?', options: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippopotamus'], answer: 2 },
  { q: 'Which country has the most population?', options: ['USA', 'India', 'China', 'Indonesia'], answer: 2 },
  { q: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Platinum'], answer: 3 },
  { q: 'How many legs does a spider have?', options: ['6', '8', '10', '12'], answer: 2 },
  { q: 'What is the smallest country in the world?', options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], answer: 2 },
  { q: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], answer: 3 },
  { q: 'What is the speed of light?', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s'], answer: 1 },
  { q: 'Who wrote Romeo and Juliet?', options: ['Dickens', 'Shakespeare', 'Austen', 'Twain'], answer: 2 },
  { q: 'What is the boiling point of water in Celsius?', options: ['90°C', '100°C', '110°C', '120°C'], answer: 2 },
  { q: 'Which element has the atomic number 1?', options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], answer: 2 },
  { q: 'What year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 3 },
  { q: 'What is the largest desert in the world?', options: ['Sahara', 'Antarctic', 'Arabian', 'Gobi'], answer: 2 },
  { q: 'How many bones are in the human body?', options: ['186', '206', '226', '246'], answer: 2 },
  { q: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 2 }
];

module.exports = {
  name: 'quiz',
  aliases: ['quizgame', 'gk'],
  category: 'game',
  description: 'Answer general knowledge quiz questions',
  usage: '.quiz',

  async execute(sock, msg, args, extra) {
    try {
      const gameKey = `${extra.from}_${extra.sender}`;

      if (args.length && activeQuizzes.has(gameKey)) {
        const game = activeQuizzes.get(gameKey);
        const answer = parseInt(args[0]);

        if (isNaN(answer) || answer < 1 || answer > 4) {
          return extra.reply('❌ Reply with a number between 1-4!');
        }

        activeQuizzes.delete(gameKey);

        if (answer === game.answer) {
          await extra.react('✅');
          return extra.reply(`✅ *Correct!* The answer was: *${game.options[game.answer - 1]}*\n\n> *KNIGHT BOT MD*`);
        } else {
          await extra.react('❌');
          return extra.reply(`❌ *Wrong!* The correct answer was: *${game.options[game.answer - 1]}*\n\n> *KNIGHT BOT MD*`);
        }
      }

      const question = questions[Math.floor(Math.random() * questions.length)];
      activeQuizzes.set(gameKey, { ...question, timestamp: Date.now() });

      setTimeout(() => { activeQuizzes.delete(gameKey); }, 30000);

      await extra.react('🧠');

      const text = `╭━━〔 🧠 QUIZ 〕━━⬣
┃
┃ ❓ *${question.q}*
┃
${question.options.map((o, i) => `┃ ${i + 1}. ${o}`).join('\n')}
┃
┃ Reply with *.quiz <1-4>*
┃ _Expires in 30 seconds_
╰━━━━━━━━━━━━━━━━━━━━⬣

> *KNIGHT BOT MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
