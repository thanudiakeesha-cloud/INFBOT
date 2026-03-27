const axios = require('axios');

module.exports = {
  name: 'filmsearch',
  aliases: ['fsearch', 'moviesearch', 'findfilm', 'searchmovie'],
  category: 'movie',
  description: 'Search for movies and TV shows by name',
  usage: '.filmsearch <movie name>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .filmsearch <movie name>\n\nExample: .filmsearch Inception');
      }

      const query = args.join(' ');
      await extra.react('🎬');

      const response = await axios.get(`https://www.omdbapi.com/?apikey=trilogy&s=${encodeURIComponent(query)}`, { timeout: 15000 });

      if (!response.data || response.data.Response === 'False') {
        return extra.reply(`❌ No results found for "${query}". Try a different search term.`);
      }

      const results = response.data.Search.slice(0, 8);

      let text = `╭━━〔 🎬 FILM SEARCH 〕━━⬣\n`;
      text += `┃ 🔍 Results for: *${query}*\n┃\n`;

      results.forEach((m, i) => {
        const typeIcon = m.Type === 'movie' ? '🎥' : m.Type === 'series' ? '📺' : '🎞️';
        text += `┃ ${i + 1}. ${typeIcon} *${m.Title}* (${m.Year})\n`;
        text += `┃    Type: ${m.Type} | ID: ${m.imdbID}\n┃\n`;
      });

      text += `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n`;
      text += `Use *.filminfo <imdb id>* for detailed info\n`;
      text += `Example: .filminfo ${results[0].imdbID}\n\n`;
      text += `> *INFINITY MD*`;

      if (results[0].Poster && results[0].Poster !== 'N/A') {
        await sock.sendMessage(extra.from, {
          image: { url: results[0].Poster },
          caption: text
        }, { quoted: msg });
      } else {
        await extra.reply(text);
      }
    } catch (error) {
      await extra.reply(`❌ Error searching films: ${error.message}`);
    }
  }
};
