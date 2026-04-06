const cheerio = require('cheerio');
const axios = require('axios');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://sinhalasub.lk';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Referer: BASE_URL,
};

// In-memory session store: chatId → [{ title, url, thumbnail, year, quality }]
const filmSessions = new Map();

async function fetchPage(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: 15000, responseType: 'text' });
  return res.data;
}

async function searchMovies(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const movies = [];
  const seen = new Set();

  $('.display-item, .module-item, .ml-item').each((_, el) => {
    if (movies.length >= 5) return;
    const $el = $(el);
    const $link = $el.find('a[href]').first();
    let movieUrl = $link.attr('href') || '';
    if (!movieUrl || seen.has(movieUrl)) return;
    if (!movieUrl.startsWith('http')) movieUrl = BASE_URL + movieUrl;
    seen.add(movieUrl);

    const title = (
      $link.attr('title')?.trim() ||
      $el.find('.item-desc-title h3, h3').first().text().trim() ||
      $el.find('h2').first().text().trim() || ''
    ).replace(/\s*\|.*$/, '').replace(/\s*Sinhala Subtitles.*$/i, '').trim();

    if (!title) return;

    const thumbnail =
      $el.find('img.thumb, img.mli-thumb').first().attr('src') ||
      $el.find('img').first().attr('data-original') ||
      $el.find('img').first().attr('src') || null;

    const quality = ($el.find('.quality').first().text().trim() + ' ' + $el.find('.qty').first().text().trim()).trim();
    const year = $el.find('.item-date, time, .year').first().text().trim() || null;

    movies.push({
      title,
      url: movieUrl,
      thumbnail: thumbnail?.startsWith('http') ? thumbnail : null,
      year: year || null,
      quality: quality || null,
    });
  });

  return movies;
}

async function getMovieDetails(pageUrl) {
  const html = await fetchPage(pageUrl);
  const $ = cheerio.load(html);

  const rawTitle = $('title').first().text()
    .replace(/\s*–\s*SinhalaSub\.LK.*$/i, '')
    .replace(/\s*\|\s*SinhalaSub\.LK.*$/i, '')
    .replace(/\s*Sinhala Subtitles.*$/i, '')
    .replace(/\s*\|.*$/, '')
    .trim() || 'Unknown Title';

  const thumbnail =
    $('img.wp-post-image, .post-thumbnail img, .item-thumb img, .poster img').first().attr('src') ||
    $('.theiaStickySidebar img, aside img').first().attr('src') || null;

  const description = $('.entry-content > p, .post-content > p, .desc-wrap p, .sinopsis p').first().text().trim() || null;
  const year = $('span.year, .date, time, [itemprop="datePublished"]').first().text().trim() || null;
  const genre = $('a[rel="category tag"], .category a, .genres a, .genre a').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(', ') || null;

  const qualities = [];
  $('#links .links-table tbody tr').each((_, row) => {
    const $row = $(row);
    const $a = $row.find('a[href]').first();
    const href = $a.attr('href') || '';
    if (!href || !href.startsWith('http')) return;
    const qualityText = $row.find('.quality, td:nth-child(2)').first().text().trim();
    const sizeText = $row.find('td:nth-child(3) span, td:nth-child(3)').first().text().trim();
    const server = $a.text().trim();
    const label = qualityText ? `${server} — ${qualityText}${sizeText ? ` (${sizeText})` : ''}` : server || 'Download';
    if (!qualities.find(q => q.url === href)) qualities.push({ label, url: href, size: sizeText || null });
  });

  // Fallback
  if (qualities.length === 0) {
    $('.links-table a[href], .content-links a[href], a[href*="/links/"]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const text = $a.text().trim();
      if (href && (href.includes('/links/') || href.startsWith('http')) && text) {
        const abs = href.startsWith('http') ? href : BASE_URL + href;
        if (!qualities.find(q => q.url === abs)) qualities.push({ label: text, url: abs, size: null });
      }
    });
  }

  return { title: rawTitle, url: pageUrl, thumbnail, description, year, genre, qualities };
}

module.exports = {
  name: 'film',
  aliases: ['movie', 'filmsel', 'filmselect'],
  category: 'media',
  description: 'Search and download movies with Sinhala subtitles',
  usage: 'film <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const prefix = extra?.prefix || '.';

    // ── STEP 2: user picked a result (filmsel 0-4) ──
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');
    const isPick = cmdName === 'filmsel' || cmdName === 'filmselect' || args[0] === 'pick';
    const pickIdx = isPick
      ? parseInt(args[0] === 'pick' ? args[1] : args[0], 10)
      : NaN;

    if (isPick && !isNaN(pickIdx)) {
      const session = filmSessions.get(chatId);
      if (!session || !session[pickIdx]) {
        return sock.sendMessage(chatId, { text: '⚠️ Session expired. Please search again with `.film <movie name>`.' }, { quoted: msg });
      }
      const movie = session[pickIdx];

      await sock.sendMessage(chatId, { text: `🎬 _Fetching details for_ *${movie.title}*...\n⏳ Please wait...` }, { quoted: msg });

      let details;
      try {
        details = await getMovieDetails(movie.url);
      } catch (err) {
        console.error('[film] detail fetch error:', err.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to fetch movie details.\n🔗 ${movie.url}` }, { quoted: msg });
      }

      let text = `🎬 *${details.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.year)  text += `📅 *Year:* ${details.year}\n`;
      if (details.genre) text += `🎭 *Genre:* ${details.genre}\n`;
      if (details.description) {
        const desc = details.description.length > 300 ? details.description.slice(0, 297) + '…' : details.description;
        text += `\n📖 *Story:*\n${desc}\n`;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;

      if (details.qualities.length === 0) {
        text += `⚠️ No download links found on this page.\n🔗 Visit directly: ${details.url}`;
        return sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      text += `📥 *Download Links* (${details.qualities.length} options):\n`;
      for (const q of details.qualities) {
        text += `\n🔹 *${q.label}*\n   🔗 ${q.url}\n`;
      }
      text += `\n> 🎬 _Infinity MD Mini • sinhalasub.lk_`;

      // Build URL buttons (max 3 visible)
      const dlButtons = details.qualities.slice(0, 3).map(q =>
        urlBtn(`⬇️ ${q.label.slice(0, 25)}`, q.url)
      );
      dlButtons.push(btn('film', '🔍 New Search'));

      const messagePayload = {
        text,
        footer: '♾️ Infinity MD Mini • Film Downloader',
        buttons: dlButtons,
      };
      if (details.thumbnail) messagePayload.image = { url: details.thumbnail };

      return sendBtn(sock, chatId, messagePayload, { quoted: msg });
    }

    // ── STEP 1: search ──
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Film Search*\n\nUsage: \`${prefix}film <movie name>\`\nExample: \`${prefix}film Avengers\`\n\n_Searches sinhalasub.lk for movies with Sinhala subtitles._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await sock.sendMessage(chatId, { text: `🔍 _Searching for_ *"${query}"*...\n⏳ Please wait...` }, { quoted: msg });

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film] search error:', err.message);
      return sock.sendMessage(chatId, { text: `❌ Search failed. The site may be temporarily down.\nTry again in a moment.` }, { quoted: msg });
    }

    if (!results.length) {
      return sock.sendMessage(chatId, { text: `❌ No results found for *"${query}"*.\n\nTry a different spelling or shorter keyword.` }, { quoted: msg });
    }

    // Store session
    filmSessions.set(chatId, results);
    setTimeout(() => filmSessions.delete(chatId), 5 * 60 * 1000); // 5 min expiry

    let text = `🎬 *Film Search Results*\n`;
    text += `🔍 Query: _${query}_\n`;
    text += `📦 Found: ${results.length} result${results.length !== 1 ? 's' : ''}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}`;
      if (m.year) text += ` _(${m.year})_`;
      if (m.quality) text += ` [${m.quality}]`;
      text += `\n`;
    });

    text += `\n💡 *Tap a button below* to see details & download links\n`;
    text += `> 🎬 _Infinity MD Mini • sinhalasub.lk_`;

    const pickButtons = results.map((m, i) => btn(`film_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));

    const thumbnail = results.find(m => m.thumbnail)?.thumbnail;
    const messagePayload = {
      text,
      footer: '♾️ Infinity MD Mini • Film Downloader',
      buttons: pickButtons,
    };
    if (thumbnail) messagePayload.image = { url: thumbnail };

    return sendBtn(sock, chatId, messagePayload, { quoted: msg });
  },
};
