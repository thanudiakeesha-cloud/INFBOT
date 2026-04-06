const cheerio = require('cheerio');
const axios = require('axios');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://sinhalasub.lk';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Referer: BASE_URL,
};

// Session stores (5-min TTL each)
const filmSessions    = new Map(); // chatId → [movie, ...]
const filmDownSessions = new Map(); // chatId → [{ label, url, title }, ...]

function setWithTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchPage(url) {
  const res = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 15000, responseType: 'text' });
  return res.data;
}

async function headRequest(url) {
  try {
    const res = await axios.head(url, {
      headers: { ...BROWSER_HEADERS, Accept: '*/*' },
      timeout: 10000,
      maxRedirects: 10,
    });
    return res;
  } catch {
    return null;
  }
}

// ─── URL resolvers ────────────────────────────────────────────────────────────
/** sinhalasub.lk/links/ → hosting site URL */
async function resolveLinksPage(linksUrl) {
  try {
    const html = await fetchPage(linksUrl);
    const $ = cheerio.load(html);
    const href = $('.wait-done a:not(.prev-lnk)').first().attr('href')
      || $('.wait-done a').first().attr('href');
    if (href && href.startsWith('http') && !href.includes('sinhalasub.lk')) return href;
  } catch (_) {}
  return linksUrl;
}

/** Convert hosting-page URLs to direct downloadable file URLs */
function toDirectDownloadUrl(url) {
  // Pixeldrain: /u/XXXXX → /api/file/XXXXX?download
  const pdMatch = url.match(/pixeldrain\.com\/u\/([A-Za-z0-9]+)/);
  if (pdMatch) return `https://pixeldrain.com/api/file/${pdMatch[1]}?download`;

  // Pixeldrain API already
  if (url.includes('pixeldrain.com/api/file/')) return url.includes('?download') ? url : url + '?download';

  return url; // return as-is for other hosts (usersdrive, etc.)
}

/** Full chain: sinhalasub links page → hosting page → direct download URL */
async function resolveFullDownloadUrl(startUrl) {
  let url = startUrl;

  if (url.includes('sinhalasub.lk/links/')) {
    url = await resolveLinksPage(url);
  }

  url = toDirectDownloadUrl(url);
  return url;
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────
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

// ─── Download & Send ──────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return 'unknown size';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function guessFilename(url, title) {
  try {
    const parts = new URL(url).pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) return decodeURIComponent(last);
  } catch (_) {}
  const safe = (title || 'movie').replace(/[^a-z0-9]/gi, '_').slice(0, 50);
  return `${safe}.mp4`;
}

function guessMime(url, contentType) {
  if (contentType && contentType !== 'application/octet-stream') return contentType.split(';')[0].trim();
  if (url.endsWith('.mkv')) return 'video/x-matroska';
  if (url.endsWith('.avi')) return 'video/x-msvideo';
  if (url.endsWith('.mp4') || url.includes('mp4')) return 'video/mp4';
  return 'video/mp4';
}

async function streamFilmToChat(sock, chatId, msg, downloadUrl, title) {
  // 1. Resolve full direct URL
  await sock.sendMessage(chatId, { text: '🔗 _Resolving download link..._' }, { quoted: msg });
  const directUrl = await resolveFullDownloadUrl(downloadUrl);

  // 2. HEAD request to get size + content-type
  const headRes = await headRequest(directUrl);
  const contentLength = headRes?.headers?.['content-length'] ? parseInt(headRes.headers['content-length']) : null;
  const contentType   = headRes?.headers?.['content-type'] || '';

  const sizeStr  = formatBytes(contentLength);
  const fileName = guessFilename(directUrl, title);
  const mimetype = guessMime(directUrl, contentType);

  // 3. Warn if very large (> 800 MB) — likely to timeout
  if (contentLength && contentLength > 800 * 1024 * 1024) {
    return sock.sendMessage(chatId, {
      text: `⚠️ *File is too large to send via WhatsApp*\n\n📦 Size: ${sizeStr}\n📁 File: ${fileName}\n\nWhatsApp limits file uploads to ~800 MB.\n\n🔗 *Direct download link:*\n${directUrl}`,
    }, { quoted: msg });
  }

  await sock.sendMessage(chatId, {
    text: `📥 *Downloading ${title}*\n📦 Size: ${sizeStr}\n📁 ${fileName}\n\n⏳ _Streaming to chat... please wait_`,
  }, { quoted: msg });

  // 4. Stream directly to Baileys as a document
  const startTime = Date.now();
  const streamRes = await axios({
    method: 'GET',
    url: directUrl,
    responseType: 'stream',
    timeout: 5 * 60 * 1000, // 5 min max
    headers: {
      ...BROWSER_HEADERS,
      Accept: '*/*',
      Referer: BASE_URL,
    },
    maxRedirects: 10,
  });

  await sock.sendMessage(chatId, {
    document: streamRes.data,
    mimetype,
    fileName,
    caption: `🎬 *${title}*\n📦 ${sizeStr}\n\n> _Infinity MD Mini • Film Downloader_`,
  }, { quoted: msg });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  await sock.sendMessage(chatId, {
    text: `✅ *Done!* Sent in ${elapsed}s\n🎬 ${fileName}`,
  }, { quoted: msg });
}

// ─── Command ──────────────────────────────────────────────────────────────────
module.exports = {
  name: 'film',
  aliases: ['movie', 'filmsel', 'filmselect', 'filmdown'],
  category: 'media',
  description: 'Search, browse, and download movies with Sinhala subtitles directly to chat',
  usage: 'film <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ─── STEP 3: Download to chat ────────────────────────────────────────────
    if (cmdName === 'filmdown') {
      const idx = parseInt(args[0], 10);
      const session = filmDownSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: '⚠️ Session expired. Please search again with `.film <movie name>` and pick a result first.',
        }, { quoted: msg });
      }
      const { url, title } = session[idx];
      try {
        await streamFilmToChat(sock, chatId, msg, url, title);
      } catch (err) {
        console.error('[film] download error:', err.message);
        return sock.sendMessage(chatId, {
          text: `❌ Download failed: ${err.message}\n\n🔗 Try opening directly:\n${url}`,
        }, { quoted: msg });
      }
      return;
    }

    // ─── STEP 2: Pick a search result → show details ─────────────────────────
    const isPick = cmdName === 'filmsel' || cmdName === 'filmselect';
    if (isPick) {
      const idx = parseInt(args[0], 10);
      const session = filmSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: '⚠️ Session expired. Please search again with `.film <movie name>`.',
        }, { quoted: msg });
      }
      const movie = session[idx];

      await sock.sendMessage(chatId, {
        text: `🎬 _Fetching details for_ *${movie.title}*...\n⏳ Please wait...`,
      }, { quoted: msg });

      let details;
      try {
        details = await getMovieDetails(movie.url);
      } catch (err) {
        console.error('[film] detail fetch error:', err.message);
        return sock.sendMessage(chatId, {
          text: `❌ Failed to fetch movie details.\n🔗 ${movie.url}`,
        }, { quoted: msg });
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

      if (!details.qualities.length) {
        text += `⚠️ No download links found.\n🔗 ${details.url}`;
        return sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      // Store download session
      const dlSession = details.qualities.slice(0, 5).map(q => ({ label: q.label, url: q.url, title: details.title }));
      setWithTTL(filmDownSessions, chatId, dlSession);

      text += `📥 *${details.qualities.length} download option${details.qualities.length !== 1 ? 's' : ''} available*\n`;
      text += `_Tap a button to send the file directly to this chat_ 📲\n`;
      details.qualities.slice(0, 5).forEach((q, i) => {
        text += `\n${i + 1}. *${q.label}*${q.size ? ` — ${q.size}` : ''}`;
      });
      text += `\n\n> 🎬 _Infinity MD Mini • sinhalasub.lk_`;

      const dlButtons = dlSession.map((q, i) => btn(`filmdown_${i}`, `⬇️ ${q.label.slice(0, 18)}`));
      dlButtons.push(btn('film', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • Film Downloader', buttons: dlButtons };
      if (details.thumbnail) payload.image = { url: details.thumbnail };

      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    // ─── STEP 1: Search ───────────────────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Film Downloader*\n\nUsage: \`${prefix}film <movie name>\`\nExample: \`${prefix}film Avengers\`\n\n_Searches sinhalasub.lk and sends the film directly to this chat._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await sock.sendMessage(chatId, {
      text: `🔍 _Searching for_ *"${query}"*...\n⏳ Please wait...`,
    }, { quoted: msg });

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film] search error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Search failed. The site may be temporarily down.\nTry again in a moment.`,
      }, { quoted: msg });
    }

    if (!results.length) {
      return sock.sendMessage(chatId, {
        text: `❌ No results for *"${query}"*.\n\nTry a different spelling or shorter keyword.`,
      }, { quoted: msg });
    }

    setWithTTL(filmSessions, chatId, results);

    let text = `🎬 *Film Search Results*\n🔍 Query: _${query}_\n📦 Found: ${results.length} result${results.length !== 1 ? 's' : ''}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}`;
      if (m.year) text += ` _(${m.year})_`;
      if (m.quality) text += ` [${m.quality}]`;
      text += `\n`;
    });
    text += `\n💡 *Tap a button* to pick a movie and download it to chat\n`;
    text += `> 🎬 _Infinity MD Mini • sinhalasub.lk_`;

    const pickButtons = results.map((m, i) => btn(`film_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));
    const thumbnail = results.find(m => m.thumbnail)?.thumbnail;

    const payload = { text, footer: '♾️ Infinity MD Mini • Film Downloader', buttons: pickButtons };
    if (thumbnail) payload.image = { url: thumbnail };

    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
