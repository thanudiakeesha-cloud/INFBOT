module.exports = {
  name: 'wouldyourather',
  aliases: ['wyr', 'rather'],
  category: 'fun',
  description: 'Get a random "Would You Rather" question',
  usage: '.wouldyourather',

  async execute(sock, msg, args, extra) {
    try {
      const questions = [
        ['have the ability to fly', 'have the ability to be invisible'],
        ['live without music', 'live without movies'],
        ['be able to read minds', 'be able to see the future'],
        ['have unlimited money', 'have unlimited knowledge'],
        ['live in the past', 'live in the future'],
        ['be the funniest person in the room', 'be the smartest person in the room'],
        ['never use social media again', 'never watch another movie'],
        ['have a rewind button for your life', 'have a pause button for your life'],
        ['always be 10 minutes late', 'always be 20 minutes early'],
        ['have no internet', 'have no air conditioning or heating'],
        ['be able to talk to animals', 'speak every human language'],
        ['have free Wi-Fi everywhere', 'have free coffee everywhere'],
        ['be a famous actor', 'be a famous musician'],
        ['live without your phone for a month', 'live without your bed for a month'],
        ['always have to say what you think', 'never speak again'],
        ['be stuck on an island alone', 'be stuck on an island with someone you hate'],
        ['have a personal chef', 'have a personal chauffeur'],
        ['never eat pizza again', 'never eat ice cream again'],
        ['fight 100 duck-sized horses', 'fight 1 horse-sized duck'],
        ['have super strength', 'have super speed'],
        ['be able to teleport', 'be able to time travel'],
        ['always be cold', 'always be hot'],
        ['live in a treehouse', 'live in a houseboat'],
        ['only eat sweet food', 'only eat salty food'],
        ['have a pet dragon', 'have a pet unicorn']
      ];

      const q = questions[Math.floor(Math.random() * questions.length)];

      await extra.react('🤔');

      const text = `╭━━〔 🤔 WOULD YOU RATHER 〕━━⬣
┃
┃ 🅰️ *${q[0]}*
┃
┃ 〰️ OR 〰️
┃
┃ 🅱️ *${q[1]}*
┃
┃ Reply with A or B!
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
