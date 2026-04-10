/**
 * .film — Cinesubz.net direct scraper
 * Sends the actual movie file as a document instead of just a link.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');
const { downloadAndSend } = require('../../utils/filmDownloader');

const BASE_URL = 'https://cinesubz.net';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const filmSessions     = new Map();
const filmDownSessions = new Map();

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

async function searchMovies(query) {
  const res = await axios.get(`${BASE_URL}/`, {
    params: { s: query },
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 20000,
  });

  const $ = cheerio.load(res.data);
  const results = [];

  $('.item-box').each((_, box) => {
    if (results.length >= 5) return;
    const $box = $(box);
    const $link = $box.find('a[href*="/movies/"]').first();
    const href = $link.attr('href') || '';
    const rawTitle = $link.attr('title') || '';
    const title = cleanTitle(rawTitle);
    if (!href || !title) return;

    const $img = $box.find('img.mli-thumb, img.thumb').first();
    const thumbnail = $img.attr('data-original') || $img.attr('src') || null;
    results.push({ title, url: href, thumbnail });
  });

  return results;
}

async function getDownloadOptions(movieUrl) {
  const res = await axios.get(movieUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': BASE_URL,
    },
    timeout: 25000,
  });

  const $ = cheerio.load(res.data);

  const rawTitle = $('h1').first().text() || $('title').text() || '';
  const title = cleanTitle(rawTitle) || 'Unknown Title';

  let thumbnail = null;
  $('img[src*="image.tmdb.org"]').each((_, el) => {
    if (!thumbnail) thumbnail = $(el).attr('src');
  });
  if (!thumbnail) {
    $('img[src*="wp-content/uploads"]').not('[src*="/no/"]').each((_, el) => {
      if (!thumbnail) thumbnail = $(el).attr('src');
    });
  }

  const qualities = [];
  const seenUrls = new Set();

  const addQuality = (href, label) => {
    if (!href || seenUrls.has(href)) return;
    seenUrls.add(href);
    qualities.push({ label: label || 'Download', url: href });
  };

  // Primary selector
  $('.movie-download-link-item').each((_, item) => {
    const $a = $(item).find('a.movie-download-button, a[href]').first();
    const href = $a.attr('href');
    if (!href) return;
    const meta = $(item).find('.movie-download-meta, .meta, span').first().text().trim();
    addQuality(href, meta || $a.text().trim() || 'Download');
  });

  // Fallback 1: any download button
  if (!qualities.length) {
    $('a.movie-download-button, a.download-button, a[class*="download"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const label = $(el).closest('[class*="item"], [class*="link"]').find('[class*="meta"], [class*="quality"], span').first().text().trim() || $(el).text().trim() || 'Download';
      addQuality(href, label);
    });
  }

  // Fallback 2: any external download-like links on the page
  if (!qualities.length) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.startsWith('http') || href.includes('cinesubz.net/movies/') || href.includes('cinesubz.net/?')) return;
      const text = $(el).text().trim();
      if (text.length < 2 || text.length > 80) return;
      addQuality(href, text);
    });
  }

  // Fallback 3: scan JavaScript for download URLs
  if (!qualities.length) {
    $('script').each((_, el) => {
      const js = $(el).html() || '';
      const patterns = [
        /["'](https?:\/\/(?:pixeldrain|mediafire|drive\.google|mega\.nz|terabox|4funbox)[^\s"']{5,})["']/g,
        /["'](https?:\/\/[^\s"']+\.(?:mp4|mkv|avi|webm)[^\s"']*)["']/g,
      ];
      for (const pat of patterns) {
        let m; pat.lastIndex = 0;
        while ((m = pat.exec(js)) !== null) addQuality(m[1], 'Download');
      }
    });
  }

  return { title, thumbnail, qualities };
}

module.exports = {
  name: 'film3',
  aliases: ['movie', 'filmsel', 'filmselect', 'filmdown'],
  category: 'media',
  description: 'Search and download movies with Sinhala subtitles from Cinesubz',
  usage: 'film <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ── Step 3: Download & send movie file ──────────────────────────────────
    if (cmdName === 'filmdown') {
      const idx     = parseInt(args[0], 10);
      const session = filmDownSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film <movie name>\`.`,
        }, { quoted: msg });
      }
      const dl = session[idx];
      await react(sock, msg, '⬇️');

      return downloadAndSend(sock, chatId, msg, {
        title: dl.title,
        quality: dl.label,
        downloadUrl: dl.url,
      });
    }

    // ── Step 2: Show quality options ─────────────────────────────────────────
    if (cmdName === 'filmsel' || cmdName === 'filmselect') {
      const idx     = parseInt(args[0], 10);
      const session = filmSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film <movie name>\`.`,
        }, { quoted: msg });
      }
      const movie = session[idx];
      await react(sock, msg, '🔍');

      let details;
      try {
        details = await getDownloadOptions(movie.url);
      } catch (err) {
        await react(sock, msg, '❌');
        return sock.sendMessage(chatId, {
          text: `❌ Couldn't load the movie page. Please try again.`,
        }, { quoted: msg });
      }

      if (!details.qualities.length) {
        await react(sock, msg, '✅');
        return sendBtn(sock, chatId, {
          text: `🎬 *${details.title}*\n\n❌ No direct links found on this page.\n\n🔗 Visit the movie page directly:\n${movie.url}\n\n> 🎬 _Infinity MD Mini • Cinesubz_`,
          footer: '♾️ Infinity MD Mini • Cinesubz',
          buttons: [
            urlBtn('🌐 Movie Page', movie.url),
            btn('film3', '🔍 New Search'),
          ],
        }, { quoted: msg });
      }

      const dlSession = details.qualities.slice(0, 5).map(q => ({
        label: q.label, url: q.url, title: details.title,
      }));
      setTTL(filmDownSessions, chatId, dlSession);

      let text = `╔══════════════════════╗\n`;
      text += `║ 🎬 *${details.title.slice(0, 30)}*\n`;
      text += `╚══════════════════════╝\n\n`;
      text += `📥 *Choose a download quality:*\n\n`;
      dlSession.forEach((q, i) => {
        text += `│ *${i + 1}.* ${q.label}\n`;
      });
      text += `\n> 💡 _Bot will download & send the file directly_\n> 🎬 _Infinity MD Mini_`;

      const dlBtns = dlSession.map((q, i) => btn(`filmdown_${i}`, `⬇️ ${q.label.slice(0, 20)}`));
      dlBtns.push(btn('film3', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • Cinesubz', buttons: dlBtns };
      if (details.thumbnail) payload.image = { url: details.thumbnail };
      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    // ── Step 1: Search ────────────────────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Film Downloader — Cinesubz*\n\nUsage: \`${prefix}film <movie name>\`\nExample: \`${prefix}film Avengers\`\n\n_Searches Cinesubz for movies with Sinhala subtitles._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film] search error:', err.message);
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `❌ Search failed. Please try again in a moment.`,
      }, { quoted: msg });
    }

    if (!results.length) {
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"*.\n\nTry a different spelling or shorter keyword.`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(filmSessions, chatId, results);

    let text = `╔══════════════════════╗\n`;
    text += `║ 🎬 *Cinesubz Results*\n`;
    text += `╚══════════════════════╝\n\n`;
    text += `🔍 _"${query}"_ — ${results.length} found\n\n`;
    results.forEach((m, i) => {
      text += `│ *${i + 1}.* ${m.title}\n`;
    });
    text += `\n> 💡 _Tap a button to select a movie_\n> 🎬 _Infinity MD Mini_`;

    const pickBtns = results.map((m, i) => btn(`film_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));
    const thumb    = results.find(m => m.thumbnail)?.thumbnail;
    const payload  = { text, footer: '♾️ Infinity MD Mini • Cinesubz', buttons: pickBtns };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
