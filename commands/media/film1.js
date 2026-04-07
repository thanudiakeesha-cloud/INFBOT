/**
 * .film1 — SriHub.store direct scraper
 * Searches by browsing paginated /movies?page=N (20 per page) and filtering by title.
 * Movie detail page: /movies/ID?slug — shows thumbnail, title
 * Download page: /download/ID — user opens to get actual download
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://srihub.store';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const film1Sessions = new Map();

function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

function cleanTitle(raw) {
  return (raw || '').split('|')[0].replace(/\s+/g, ' ').trim();
}

function matchesQuery(title, query) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const t = title.toLowerCase();
  return words.some(w => t.includes(w));
}

function extractMovieId(href) {
  const m = href.match(/\/movies\/([a-zA-Z0-9M\-]+)/);
  return m ? m[1] : null;
}

async function fetchPage(page) {
  const res = await axios.get(`${BASE_URL}/movies`, {
    params: page > 1 ? { page } : {},
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });
  return res.data;
}

async function searchMovies(query) {
  const results = [];
  const seen = new Set();

  for (let page = 1; page <= 8 && results.length < 5; page++) {
    let html;
    try {
      html = await fetchPage(page);
    } catch (err) {
      break;
    }

    const $ = cheerio.load(html);
    let foundOnPage = 0;

    $('a[href*="/movies/"]').each((_, el) => {
      if (results.length >= 5) return;
      const $a = $(el);
      const href = $a.attr('href') || '';
      const movieId = extractMovieId(href);
      if (!movieId || seen.has(movieId)) return;

      const $img = $a.find('img').first();
      const rawTitle = $img.attr('alt') || '';
      const title = cleanTitle(rawTitle);
      if (!title) return;

      seen.add(movieId);
      foundOnPage++;

      if (!matchesQuery(title, query)) return;

      const thumbnail = $img.attr('src') || null;
      const movieUrl = `${BASE_URL}${href.split('?')[0]}`;
      const downloadUrl = `${BASE_URL}/download/${movieId}`;

      results.push({ title, url: movieUrl, downloadUrl, thumbnail });
    });

    if (foundOnPage === 0) break;
  }

  return results;
}

module.exports = {
  name: 'film1',
  aliases: ['film1sel', 'film1select'],
  category: 'media',
  description: 'Search and get movie download links from SriHub (Sinhala subtitles)',
  usage: 'film1 <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    if (cmdName === 'film1sel' || cmdName === 'film1select') {
      const idx     = parseInt(args[0], 10);
      const session = film1Sessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film1 <movie name>\`.`,
        }, { quoted: msg });
      }

      const movie = session[idx];
      await react(sock, msg, '✅');

      let text = `🎬 *${movie.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📥 *Tap the button below to open the download page*\n\n`;
      text += `🔗 Download Page:\n${movie.downloadUrl}\n\n`;
      text += `> 🎬 _Infinity MD Mini • SriHub_`;

      const payload = {
        text,
        footer: '♾️ Infinity MD Mini • SriHub',
        buttons: [
          urlBtn('⬇️ Download Page', movie.downloadUrl),
          urlBtn('🌐 Movie Page', movie.url),
          btn('film1', '🔍 New Search'),
        ],
      };
      if (movie.thumbnail) payload.image = { url: movie.thumbnail };
      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Film Search — SriHub*\n\nUsage: \`${prefix}film1 <movie name>\`\nExample: \`${prefix}film1 Avengers\`\n\n_Searches SriHub.store for the latest movies with Sinhala subtitles._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film1] search error:', err.message);
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `❌ Search failed. Please try again in a moment.`,
      }, { quoted: msg });
    }

    if (!results.length) {
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"* on SriHub.\n\nTry a different spelling or shorter keyword.\n\n> _Note: SriHub mainly has recent/new movies._`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(film1Sessions, chatId, results);

    let text = `🎬 *SriHub Film Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}\n`;
    });
    text += `\n💡 *Tap a button to get the download link*\n> 🎬 _Infinity MD Mini_`;

    const pickBtns = results.map((m, i) => btn(`film1_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));
    const thumb    = results.find(m => m.thumbnail)?.thumbnail;
    const payload  = { text, footer: '♾️ Infinity MD Mini • SriHub', buttons: pickBtns };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
