const cheerio = require('cheerio');
const axios = require('axios');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://srihub.store';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
};

const film1Sessions = new Map();

function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
    responseType: 'text',
    maxRedirects: 10,
  });
  return res.data;
}

async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

function cleanTitle(raw) {
  return raw
    .replace(/\s*\|.*$/, '')
    .replace(/\s*සිංහල.*$/u, '')
    .replace(/\s*Sinhala.*$/i, '')
    .trim();
}

async function searchMovies(query) {
  const movies = [];
  const seen = new Set();
  const q = query.toLowerCase();
  const MAX_PAGES = 3;

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (movies.length >= 5) break;
    const url = page === 1 ? `${BASE_URL}/movies` : `${BASE_URL}/movies?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch (_) { break; }
    const $ = cheerio.load(html);

    let foundOnPage = 0;
    $('a[href^="/movies/"]').each((_, el) => {
      if (movies.length >= 5) return false;
      const $el = $(el);
      const href = $el.attr('href') || '';
      const id = (href.split('/movies/')[1] || '').split('?')[0].trim();
      if (!id || seen.has(id)) return;

      const alt = $el.find('img').first().attr('alt') || '';
      if (!alt || alt === 'SriHub Logo') return;

      foundOnPage++;
      const titleRaw = cleanTitle(alt);
      if (!titleRaw) return;
      if (!titleRaw.toLowerCase().includes(q) && !alt.toLowerCase().includes(q)) return;

      seen.add(id);
      const yearMatch = alt.match(/[\(\[]\s*(\d{4})\s*[\)\]]/);
      const year = yearMatch ? yearMatch[1] : null;
      const thumbnail = $el.find('img').first().attr('src') || null;
      movies.push({ title: titleRaw, year, url: `${BASE_URL}${href}`, thumbnail, id });
    });

    if (foundOnPage === 0) break;
  }

  return movies;
}

async function getMovieDetails(movieUrl) {
  const html = await fetchHtml(movieUrl);
  const $ = cheerio.load(html);

  let ldJson = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data['@type'] === 'Movie') { ldJson = data; return false; }
    } catch (_) {}
  });

  const title = ldJson?.name ? cleanTitle(ldJson.name) : ($('h1').first().text().trim() || 'Unknown Title');
  const description = ldJson?.description || null;
  const thumbnail = ldJson?.image || null;
  const year = ldJson?.datePublished || null;
  const genres = Array.isArray(ldJson?.genre) ? ldJson.genre : (ldJson?.genre ? [ldJson.genre] : []);
  const rating = ldJson?.aggregateRating?.ratingValue || null;

  const duration = $('[class*="dataDuration"]').first().text().trim() || null;
  const language = $('[class*="dataLanguage"]').first().text().trim() || null;
  const quality  = $('[class*="dataQuality"]').first().text().trim() || null;

  const downloadHref = $('a[href^="/download/"]').first().attr('href') || '';
  const downloadId  = downloadHref.replace('/download/', '') || null;
  const downloadUrl = downloadId ? `${BASE_URL}/download/${downloadId}` : null;

  let director = null;
  $('[class*="detailsInfo"] p').each((_, el) => {
    const $el = $(el);
    if ($el.find('strong').text().toLowerCase().includes('director')) {
      director = $el.find('span').text().trim() || null;
      return false;
    }
  });

  return { title, description, thumbnail, year, genres, rating, duration, language, quality, downloadUrl, downloadId, director };
}

async function getDownloadQualities(downloadId) {
  const html = await fetchHtml(`${BASE_URL}/download/${downloadId}`);
  const $ = cheerio.load(html);
  const qualities = [];
  $('button[class*="download_btn"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) qualities.push(text);
  });
  return qualities;
}

module.exports = {
  name: 'film1',
  aliases: ['film1sel', 'film1select'],
  category: 'media',
  description: 'Search and get movie info from SriHub (Sinhala subtitles)',
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
      await react(sock, msg, '🔍');

      let details;
      try {
        details = await getMovieDetails(movie.url);
      } catch (err) {
        await react(sock, msg, '❌');
        return sock.sendMessage(chatId, {
          text: `❌ Couldn't load the movie page. Please try again.`,
        }, { quoted: msg });
      }

      let qualities = [];
      if (details.downloadId) {
        try { qualities = await getDownloadQualities(details.downloadId); } catch (_) {}
      }

      await react(sock, msg, '✅');

      let text = `🎬 *${details.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.year)     text += `📅 *Year:* ${details.year}\n`;
      if (details.duration) text += `⏱️ *Duration:* ${details.duration}\n`;
      if (details.language) text += `🗣️ *Language:* ${details.language}\n`;
      if (details.quality)  text += `📺 *Quality:* ${details.quality}\n`;
      if (details.rating)   text += `⭐ *Rating:* ${details.rating}/10\n`;
      if (details.director) text += `🎬 *Director:* ${details.director}\n`;
      if (details.genres?.length) text += `🎭 *Genre:* ${details.genres.join(', ')}\n`;
      if (details.description) {
        const d = details.description.length > 300 ? details.description.slice(0, 297) + '…' : details.description;
        text += `\n📖 *Story:*\n${d}\n`;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (qualities.length) {
        text += `📥 *Available:* ${qualities.join(' | ')}\n\n`;
      }
      if (details.downloadUrl) {
        text += `🔗 *Download page:*\n${details.downloadUrl}\n`;
      }
      text += `\n> 🎬 _Infinity MD Mini • SriHub_`;

      const btns = [];
      if (details.downloadUrl) btns.push(urlBtn('⬇️ Download Now', details.downloadUrl));
      btns.push(btn('film1', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • SriHub', buttons: btns };
      if (details.thumbnail) payload.image = { url: details.thumbnail };
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
        text: `😔 No results found for *"${query}"* on SriHub.\n\nTry a different spelling or shorter keyword.\n_Note: Shows latest 20 movies — older titles may not appear._`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(film1Sessions, chatId, results);

    let text = `🎬 *SriHub Film Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}`;
      if (m.year) text += ` _(${m.year})_`;
      text += `\n`;
    });
    text += `\n💡 *Tap a button to see details & download link*\n> 🎬 _Infinity MD Mini_`;

    const pickBtns = results.map((m, i) => btn(`film1_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));
    const thumb    = results.find(m => m.thumbnail)?.thumbnail;
    const payload  = { text, footer: '♾️ Infinity MD Mini • SriHub', buttons: pickBtns };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
