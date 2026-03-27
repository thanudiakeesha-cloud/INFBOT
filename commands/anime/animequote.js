const axios = require('axios');

const quotes = [
  { quote: "People's lives don't end when they die. It ends when they lose faith.", character: "Itachi Uchiha", anime: "Naruto" },
  { quote: "If you don't take risks, you can't create a future.", character: "Monkey D. Luffy", anime: "One Piece" },
  { quote: "The world isn't perfect. But it's there for us, doing the best it can.", character: "Roy Mustang", anime: "Fullmetal Alchemist" },
  { quote: "Fear is not evil. It tells you what your weakness is.", character: "Gildarts Clive", anime: "Fairy Tail" },
  { quote: "Whatever you lose, you'll find it again. But what you throw away you'll never get back.", character: "Kenshin Himura", anime: "Rurouni Kenshin" },
  { quote: "A lesson without pain is meaningless.", character: "Edward Elric", anime: "Fullmetal Alchemist: Brotherhood" },
  { quote: "Believing in someone. That's a strength all on its own.", character: "Yato", anime: "Noragami" },
  { quote: "If you don't like your destiny, don't accept it. Instead, have the courage to change it.", character: "Naruto Uzumaki", anime: "Naruto" },
  { quote: "The only ones who should kill are those who are prepared to be killed.", character: "Lelouch vi Britannia", anime: "Code Geass" },
  { quote: "In this world, wherever there is light – there are also shadows.", character: "Madara Uchiha", anime: "Naruto Shippuden" },
  { quote: "Power comes in response to a need, not a desire.", character: "Goku", anime: "Dragon Ball Z" },
  { quote: "I'll leave tomorrow's problems to tomorrow's me.", character: "Saitama", anime: "One Punch Man" },
  { quote: "Forgetting is like a wound. The wound may heal, but it has already left a scar.", character: "Monkey D. Luffy", anime: "One Piece" },
  { quote: "Hard work is worthless for those that don't believe in themselves.", character: "Naruto Uzumaki", anime: "Naruto" },
  { quote: "Even if I die, you keep living okay? Live to see the end of this world, and to see why it was born.", character: "Corazon", anime: "One Piece" },
  { quote: "Being weak is nothing to be ashamed of. Staying weak is!", character: "Fuegoleon Vermillion", anime: "Black Clover" },
  { quote: "Life is not a game of luck. If you wanna win, work hard.", character: "Sora", anime: "No Game No Life" },
  { quote: "The moment you think of giving up, think of the reason why you held on so long.", character: "Natsu Dragneel", anime: "Fairy Tail" },
  { quote: "You should enjoy the little detours to the fullest. Because that's where you'll find the things more important than what you want.", character: "Ging Freecss", anime: "Hunter x Hunter" },
  { quote: "To know sorrow is not terrifying. What is terrifying is to know you can't go back to happiness you could have.", character: "Matsumoto Rangiku", anime: "Bleach" },
  { quote: "It's not the face that makes someone a monster; it's the choices they make with their lives.", character: "Naruto Uzumaki", anime: "Naruto" },
  { quote: "We are all like fireworks: We climb, we shine and always go our separate ways and become further apart.", character: "Hitsugaya Toshiro", anime: "Bleach" },
  { quote: "Don't give up, there's no shame in falling down! True shame is to not stand up again!", character: "Shintaro Midorima", anime: "Kuroko no Basket" },
  { quote: "Who decides limits? And based on what? You said you worked hard? Well, maybe you need to work a little harder.", character: "Saitama", anime: "One Punch Man" },
  { quote: "Reject common sense to make the impossible possible.", character: "Simon", anime: "Gurren Lagann" },
  { quote: "Do not seek aesthetics in waging war. Do not seek virtue in death.", character: "Genryusai Yamamoto", anime: "Bleach" },
  { quote: "Those who stand at the top determine what's wrong and what's right!", character: "Sosuke Aizen", anime: "Bleach" },
  { quote: "The ticket to the future is always open.", character: "Vash the Stampede", anime: "Trigun" },
  { quote: "It's okay not to be okay as long as you are not giving up.", character: "Karen Aijou", anime: "Revue Starlight" },
  { quote: "Every journey begins with a single step. We just have to have patience.", character: "Milly Thompson", anime: "Trigun" }
];

module.exports = {
  name: 'animequote',
  aliases: ['aquote', 'animequotes'],
  category: 'anime',
  desc: 'Get a random anime quote',
  usage: 'animequote',
  execute: async (sock, msg, args, extra) => {
    try {
      let quote;
      try {
        const response = await axios.get('https://animechan.io/api/v1/quotes/random', {
          timeout: 10000,
          headers: { 'Accept': 'application/json' }
        });
        if (response.data && response.data.data) {
          const d = response.data.data;
          quote = {
            quote: d.content,
            character: d.character?.name || 'Unknown',
            anime: d.anime?.name || 'Unknown'
          };
        }
      } catch (e) {
        quote = quotes[Math.floor(Math.random() * quotes.length)];
      }

      if (!quote) {
        quote = quotes[Math.floor(Math.random() * quotes.length)];
      }

      const text = `🌸 *Anime Quote* 🌸\n\n` +
        `_"${quote.quote}"_\n\n` +
        `👤 *Character:* ${quote.character}\n` +
        `🎬 *Anime:* ${quote.anime}`;

      await sock.sendMessage(extra.from, { text }, { quoted: msg });
    } catch (error) {
      console.error('Error in animequote command:', error);
      await extra.reply('❌ Failed to fetch anime quote. Please try again.');
    }
  }
};
