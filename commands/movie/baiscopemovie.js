const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
};

async function searchCinesubz(query) {
  const url = `https://cinesubz.lk/?s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { timeout: 20000, headers: HEADERS });
  const $ = cheerio.load(data);
  const results = [];

  $('.item-box').each((i, el) => {
    if (results.length >= 8) return;
    const a = $(el).find('a').first();
    const href = a.attr('href');
    const img = $(el).find('img').first();
    const imgSrc = img.attr('src') || img.attr('data-src') || '';
    const rawAlt = img.attr('alt') || '';
    const title = rawAlt.split('|')[0].trim() || href?.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Unknown';
    const text = $(el).text().trim();
    const ratingMatch = text.match(/★([\d.]+)/);
    const qualityMatch = text.match(/(BluRay|WEBRip|WEB-DL|HDTV|DVDRip|Remux|4K|1080p|720p)/i);
    if (href) {
      results.push({
        title,
        url: href,
        image: imgSrc,
        rating: ratingMatch ? ratingMatch[1] : null,
        quality: qualityMatch ? qualityMatch[1] : null
      });
    }
  });

  return results;
}

const pendingSessions = new Map();

module.exports = {
  name: 'movie',
  aliases: ['film', 'cinesub', 'sinhala'],
  category: 'movie',
  description: 'Search movies with Sinhala subtitles on Cinesubz',
  usage: '.movie <movie name>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return reply(
          '❌ Please provide a movie name.\n\n' +
          '📌 *Usage:* .movie <movie name>\n' +
          'Example: .movie Avengers'
        );
      }

      await react('🔍');

      let results;
      try {
        results = await searchCinesubz(query);
      } catch (e) {
        await react('❌');
        return reply('❌ Search failed. Please try again later.');
      }

      if (!results || results.length === 0) {
        await react('❌');
        return reply(`❌ No results found for *"${query}"*.\nTry a different movie name.`);
      }

      let caption =
        `╭━━〔 🎬 *CINESUBZ SEARCH* 〕━━⬣\n` +
        `┃ 🔍 *${query}*\n┃\n`;

      results.forEach((item, i) => {
        caption += `┃ *${i + 1}.* ${item.title}\n`;
        const meta = [
          item.rating ? `⭐ ${item.rating}` : null,
          item.quality ? `🎞️ ${item.quality}` : null
        ].filter(Boolean).join('  ');
        if (meta) caption += `┃    ${meta}\n`;
        caption += '┃\n';
      });

      caption +=
        `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
        `↩️ *Reply with 1–${results.length} to get the download page*\n` +
        `> *INFINITY MD*`;

      const firstImg = results[0]?.image;
      const sentMsg = await sock.sendMessage(from, firstImg
        ? { image: { url: firstImg }, caption }
        : { text: caption },
        { quoted: msg }
      );

      const sessionKey = `movie_${from}_${msg.key.participant || msg.key.remoteJid}`;
      pendingSessions.set(sessionKey, {
        items: results,
        msgId: sentMsg.key.id,
        ts: Date.now()
      });
      setTimeout(() => pendingSessions.delete(sessionKey), 5 * 60 * 1000);

      await react('✅');

    } catch (err) {
      console.error('Movie search error:', err.message);
      await react('❌');
      reply('❌ An error occurred. Please try again later.');
    }
  },

  async handleReply(sock, msg, body, from, sender) {
    const sessionKey = `movie_${from}_${sender}`;
    const session = pendingSessions.get(sessionKey);
    if (!session) return false;

    const choice = parseInt(body.trim(), 10);
    if (isNaN(choice) || choice < 1 || choice > session.items.length) return false;

    pendingSessions.delete(sessionKey);
    const selected = session.items[choice - 1];

    let text =
      `╭━━〔 🎬 *MOVIE LINK* 〕━━⬣\n` +
      `┃ 📽️ *${selected.title}*\n`;
    if (selected.rating) text += `┃ ⭐ Rating: ${selected.rating}\n`;
    if (selected.quality) text += `┃ 🎞️ Quality: ${selected.quality}\n`;
    text +=
      `┃\n` +
      `┃ 🔗 *Download Page:*\n` +
      `┃ ${selected.url}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
      `> *INFINITY MD*`;

    await sock.sendMessage(from, { text }, { quoted: msg });
    return true;
  }
};
