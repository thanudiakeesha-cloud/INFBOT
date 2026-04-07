/**
 * .film3 — SinhalaSub.lk scraper (ported from TeraBOX-Movies project)
 *
 * Flow:
 *   1. .film3 <query>   → scrape sinhalasub.lk/?s=QUERY, list movies
 *   2. .film3sel <idx>  → scrape movie detail page, list quality options
 *   3. .film3dl <idx>   → scrape /links/<code>/ to resolve final download URL
 *
 * Selectors (from TeraBOX-Movies scraper.ts):
 *   Search:  .display-item, .module-item, .ml-item
 *   Details: #links .links-table tbody tr  (fallback: a[href*='/links/'])
 *   Resolve: .wait-done a:not(.prev-lnk)
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://sinhalasub.lk';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': BASE_URL,
};

const searchSessions = new Map();
const detailSessions = new Map();

function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*–\s*SinhalaSub\.LK.*/i, '')
    .replace(/\s*\|\s*SinhalaSub\.LK.*/i, '')
    .replace(/\s*Sinhala Subtitles.*/i, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 20000,
    maxRedirects: 8,
  });
  return res.data;
}

async function searchMovies(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const results = [];
  const seen = new Set();

  $('.display-item, .module-item, .ml-item').each((_, el) => {
    if (results.length >= 5) return;
    const $el = $(el);
    const $link = $el.find('a[href]').first();
    let movieUrl = $link.attr('href') || '';
    if (!movieUrl) return;
    if (!movieUrl.startsWith('http')) movieUrl = BASE_URL + movieUrl;
    if (seen.has(movieUrl)) return;
    seen.add(movieUrl);

    const rawTitle = $link.attr('title')?.trim()
      || $el.find('.item-desc-title h3, h3').first().text().trim()
      || $el.find('h2').first().text().trim()
      || '';
    const title = cleanTitle(rawTitle);
    if (!title) return;

    const thumbnail =
      $el.find('img.thumb, img.mli-thumb').first().attr('src')
      || $el.find('img').first().attr('data-original')
      || $el.find('img').first().attr('src')
      || null;

    const quality = ($el.find('.quality').first().text().trim()
      + ' ' + $el.find('.qty').first().text().trim()).trim() || null;
    const year = $el.find('.item-date, time, .year').first().text().trim() || null;

    results.push({
      title,
      url: movieUrl,
      thumbnail: (thumbnail && thumbnail.startsWith('http')) ? thumbnail : null,
      quality,
      year,
    });
  });

  return results;
}

async function getMovieDetails(pageUrl) {
  const html = await fetchPage(pageUrl);
  const $ = cheerio.load(html);

  const rawTitle = $('title').first().text() || '';
  const title = cleanTitle(rawTitle) || 'Unknown Title';

  const thumbnail =
    $('img.wp-post-image, .post-thumbnail img, .item-thumb img, .poster img').first().attr('src')
    || $('.theiaStickySidebar img, aside img').first().attr('src')
    || null;

  const description =
    $('.entry-content > p, .post-content > p, .desc-wrap p, .sinopsis p').first().text().trim() || null;

  const year = $('span.year, .date, time, [itemprop="datePublished"]').first().text().trim() || null;
  const language = $('span.language, .lang, [itemprop="inLanguage"]').first().text().trim() || null;
  const genreLinks = $('a[rel="category tag"], .category a, .genres a, .genre a');
  const genre = genreLinks.length > 0
    ? genreLinks.map((_, el) => $(el).text().trim()).get().filter(Boolean).join(', ')
    : null;

  const qualities = [];

  $('#links .links-table tbody tr').each((_, row) => {
    const $row = $(row);
    const $a = $row.find('a[href]').first();
    const href = $a.attr('href') || '';
    const qualityText = $row.find('.quality, td:nth-child(2)').first().text().trim();
    const sizeText = $row.find('td:nth-child(3) span, td:nth-child(3)').first().text().trim();
    const serverName = $a.text().trim();

    if (href && href.startsWith('http')) {
      const label = qualityText ? `${serverName} — ${qualityText}` : serverName || 'Download';
      if (!qualities.find(q => q.url === href)) {
        qualities.push({ label, url: href, size: sizeText || null });
      }
    }
  });

  if (qualities.length === 0) {
    $(".links-table a[href], .content-links a[href], a[href*='/links/']").each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const text = $a.text().trim();
      if (href && (href.includes('/links/') || href.startsWith('http')) && text) {
        const absHref = href.startsWith('http') ? href : BASE_URL + href;
        if (!qualities.find(q => q.url === absHref)) {
          qualities.push({ label: text, url: absHref, size: null });
        }
      }
    });
  }

  return { title, thumbnail, description, year, language, genre, qualities };
}

async function resolveDownload(linkUrl) {
  if (!linkUrl.includes('sinhalasub.lk/links/')) {
    return linkUrl;
  }
  const html = await fetchPage(linkUrl);
  const $ = cheerio.load(html);

  const continueHref =
    $('.wait-done a:not(.prev-lnk)').first().attr('href')
    || $('.wait-done a').first().attr('href')
    || null;

  if (continueHref && continueHref.startsWith('http') && !continueHref.includes('sinhalasub.lk')) {
    return continueHref;
  }
  return linkUrl;
}

module.exports = {
  name: 'film3',
  aliases: ['sinhalasub', 'film3sel', 'film3select', 'film3dl'],
  category: 'media',
  description: 'Search and download movies from SinhalaSub.lk',
  usage: 'film3 <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ── Step 3: Resolve download link ─────────────────────────────────────
    if (cmdName === 'film3dl') {
      const idx     = parseInt(args[0], 10);
      const session = detailSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const entry = session[idx];
      await react(sock, msg, '🔍');

      let finalUrl = entry.url;
      try {
        finalUrl = await resolveDownload(entry.url);
      } catch (_) {}

      await react(sock, msg, '✅');

      return sendBtn(sock, chatId, {
        text: `📥 *${entry.movieTitle}*\n\n🎬 *Quality:* ${entry.label}${entry.size ? ` — ${entry.size}` : ''}\n\n🔗 Tap the button to download:\n\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`,
        footer: '♾️ Infinity MD Mini • SinhalaSub.lk',
        buttons: [
          urlBtn('⬇️ Download Now', finalUrl),
          btn('film3', '🔍 New Search'),
        ],
      }, { quoted: msg });
    }

    // ── Step 2: Show movie details & quality options ───────────────────────
    if (cmdName === 'film3sel' || cmdName === 'film3select') {
      const idx     = parseInt(args[0], 10);
      const session = searchSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const movie = session[idx];
      await react(sock, msg, '🔍');

      let details;
      try {
        details = await getMovieDetails(movie.url);
      } catch (err) {
        await react(sock, msg, '❌');
        const isBlocked = String(err.message).includes('403');
        return sock.sendMessage(chatId, {
          text: isBlocked
            ? `❌ *SinhalaSub.lk is currently blocking requests.*\n\n🔗 Open the page directly:\n${movie.url}\n\n> 🎬 _Infinity MD Mini_`
            : `❌ Couldn't load the movie page. Please try again.`,
        }, { quoted: msg });
      }

      if (!details.qualities.length) {
        await react(sock, msg, '✅');
        return sendBtn(sock, chatId, {
          text: `🎬 *${details.title}*\n\n❌ No download links found on this page.\n\n🔗 Visit directly:\n${movie.url}\n\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`,
          footer: '♾️ Infinity MD Mini • SinhalaSub.lk',
          buttons: [
            urlBtn('🌐 Movie Page', movie.url),
            btn('film3', '🔍 New Search'),
          ],
        }, { quoted: msg });
      }

      const dlSession = details.qualities.slice(0, 5).map(q => ({
        label: q.label,
        url: q.url,
        size: q.size,
        movieTitle: details.title,
      }));
      setTTL(detailSessions, chatId, dlSession);

      let text = `🎬 *${details.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.year)     text += `📅 *Year:* ${details.year}\n`;
      if (details.language) text += `🗣️ *Language:* ${details.language}\n`;
      if (details.genre)    text += `🎭 *Genre:* ${details.genre}\n`;
      if (details.description) {
        const d = details.description.length > 250 ? details.description.slice(0, 247) + '…' : details.description;
        text += `\n📖 *Story:*\n${d}\n`;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📥 *Choose a download quality:*\n\n`;
      dlSession.forEach((q, i) => {
        text += `*${i + 1}.* ${q.label}${q.size ? ` — ${q.size}` : ''}\n`;
      });
      text += `\n💡 _Tap a button to get the download link_\n> 🎬 _Infinity MD Mini_`;

      const dlBtns = dlSession.map((q, i) => btn(`film3dl_${i}`, `⬇️ ${q.label.slice(0, 20)}`));
      dlBtns.push(btn('film3', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • SinhalaSub.lk', buttons: dlBtns };
      if (details.thumbnail) payload.image = { url: details.thumbnail };
      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    // ── Step 1: Search ─────────────────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *SinhalaSub.lk Film Search*\n\nUsage: \`${prefix}film3 <movie name>\`\nExample: \`${prefix}film3 Avengers\`\n\n_Searches SinhalaSub.lk for movies with Sinhala subtitles._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film3] search error:', err.message);
      await react(sock, msg, '❌');
      const isBlocked = String(err.message).includes('403');
      return sock.sendMessage(chatId, {
        text: isBlocked
          ? `❌ *SinhalaSub.lk is currently blocking requests.*\n\nTry \`${prefix}film\` (Cinesubz) or \`${prefix}film1\` (SriHub) instead.`
          : `❌ Search failed. Please try again in a moment.`,
      }, { quoted: msg });
    }

    if (!results.length) {
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"* on SinhalaSub.lk.\n\nTry a shorter or different keyword.`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(searchSessions, chatId, results);

    let text = `🎬 *SinhalaSub.lk Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}`;
      if (m.quality) text += ` [${m.quality}]`;
      if (m.year)    text += ` (${m.year})`;
      text += `\n`;
    });
    text += `\n💡 *Tap a button to see download options*\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`;

    const pickBtns = results.map((m, i) =>
      btn(`film3sel_${i}`, `${i + 1}. ${m.title.slice(0, 22)}`)
    );

    const thumb = results.find(m => m.thumbnail)?.thumbnail;
    const payload = {
      text,
      footer: '♾️ Infinity MD Mini • SinhalaSub.lk',
      buttons: pickBtns,
    };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
