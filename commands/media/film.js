const cheerio = require('cheerio');
const axios = require('axios');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const BASE_URL = 'https://sinhalasub.lk';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  Referer: BASE_URL,
};

// ── Session stores (5-min TTL) ────────────────────────────────────────────────
const filmSessions    = new Map(); // chatId → [movie, …]
const filmDownSessions = new Map(); // chatId → [{ label, quality, url, title }, …]

function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function fetchHtml(url, extraHeaders = {}) {
  const res = await axios.get(url, {
    headers: { ...BROWSER_HEADERS, ...extraHeaders },
    timeout: 15000,
    responseType: 'text',
    maxRedirects: 10,
  });
  return res.data;
}

async function tryHead(url) {
  try {
    const res = await axios.head(url, {
      headers: { ...BROWSER_HEADERS, Accept: '*/*' },
      timeout: 8000,
      maxRedirects: 10,
    });
    return { ok: true, headers: res.headers, status: res.status };
  } catch (e) {
    return { ok: false, status: e?.response?.status || 0 };
  }
}

// ── Quality label extraction ──────────────────────────────────────────────────
// Turn "UsersDrive — 1080p (2.1 GB)" → { display: "1080p", size: "2.1 GB" }
function parseQualityLabel(raw) {
  // Extract resolution
  const resMatch = raw.match(/\b(4K|2160p|1080p|720p|480p|360p|240p)\b/i);
  const resolution = resMatch ? resMatch[0].toUpperCase().replace('2160P', '4K').replace(/P$/, 'p') : null;

  // Extract size e.g. "(2.1 GB)" or "(700 MB)"
  const sizeMatch = raw.match(/\(?\s*(\d+(?:\.\d+)?\s*(?:GB|MB|TB|KB))\s*\)?/i);
  const size = sizeMatch ? sizeMatch[1].trim() : null;

  // Source type fallback
  const srcMatch = raw.match(/\b(BluRay|Blu-Ray|WEB-DL|WEBRip|HDCAM|HDTS|CAM|DVDRip|HQ)\b/i);
  const src = srcMatch ? srcMatch[0] : null;

  const display = resolution || src || null;
  return { display, size };
}

// ── URL resolution chain ──────────────────────────────────────────────────────
/** sinhalasub.lk/links/XXX/ → Continue href on that page */
async function resolveLinksPage(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    // "Continue" button / link on the wait page
    const href = $('.wait-done a:not(.prev-lnk)').first().attr('href')
      || $('.wait-done a').first().attr('href')
      || $('a.btn-success[href]').first().attr('href')
      || $('a[href*="pixeldrain"], a[href*="usersdrive"], a[href*="drive.google"], a[href*="mega.nz"]').first().attr('href');
    if (href && href.startsWith('http') && !href.includes('sinhalasub.lk')) return href;
  } catch (_) {}
  return url;
}

/** Convert a known hosting page URL → direct downloadable file URL */
async function toDirectUrl(url) {
  // ── Pixeldrain ──
  const pdMatch = url.match(/pixeldrain\.com\/u\/([A-Za-z0-9]+)/);
  if (pdMatch) {
    const apiUrl = `https://pixeldrain.com/api/file/${pdMatch[1]}?download`;
    // Verify file exists
    const check = await tryHead(apiUrl);
    if (check.ok && check.status < 400) return { url: apiUrl, method: 'stream' };
    return { url, method: 'link' }; // file gone — give original link
  }

  // ── UsersDrive ──
  if (url.includes('usersdrive.com')) {
    // Try extracting a direct download token from the page
    try {
      const html = await fetchHtml(url, { Referer: url });
      const $ = cheerio.load(html);
      // Typical usersdrive direct link
      const dlLink = $('a#downloadbtn[href], a.btn[href*="download"], a[href*=".mp4"], a[href*=".mkv"]').first().attr('href')
        || $('form[method=post] + a, .download-area a').first().attr('href');
      if (dlLink && dlLink.startsWith('http') && (dlLink.includes('.mp4') || dlLink.includes('.mkv') || dlLink.includes('download'))) {
        return { url: dlLink, method: 'stream' };
      }
    } catch (_) {}
    return { url, method: 'link' };
  }

  // ── Google Drive ──
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) {
    const directGd = `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
    return { url: directGd, method: 'link' }; // Google blocks server-side
  }

  // ── Mega.nz ──
  if (url.includes('mega.nz')) {
    return { url, method: 'link' }; // Mega requires client-side decryption
  }

  // ── Any other direct file URL (.mp4/.mkv) ──
  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(url)) {
    return { url, method: 'stream' };
  }

  // ── Unknown host ──
  return { url, method: 'link' };
}

/** Full resolution: sinhalasub → host page → direct download URL */
async function resolveDownloadUrl(startUrl) {
  let url = startUrl;
  if (url.includes('sinhalasub.lk/links/')) {
    url = await resolveLinksPage(url);
  }
  return toDirectUrl(url);
}

// ── Scrapers ──────────────────────────────────────────────────────────────────
async function searchMovies(query) {
  const html = await fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
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

    const title = ($link.attr('title')?.trim()
      || $el.find('.item-desc-title h3, h3').first().text().trim()
      || $el.find('h2').first().text().trim() || '')
      .replace(/\s*\|.*$/, '').replace(/\s*Sinhala Subtitles.*$/i, '').trim();
    if (!title) return;

    const thumbnail =
      $el.find('img.thumb, img.mli-thumb').first().attr('src') ||
      $el.find('img').first().attr('data-original') ||
      $el.find('img').first().attr('src') || null;

    const quality = ($el.find('.quality').first().text().trim() + ' ' + $el.find('.qty').first().text().trim()).trim();
    const year = $el.find('.item-date, time, .year').first().text().trim() || null;

    movies.push({
      title, url: movieUrl,
      thumbnail: thumbnail?.startsWith('http') ? thumbnail : null,
      year: year || null, quality: quality || null,
    });
  });
  return movies;
}

async function getMovieDetails(pageUrl) {
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);

  const title = $('title').first().text()
    .replace(/\s*[–|]\s*SinhalaSub\.LK.*$/i, '')
    .replace(/\s*Sinhala Subtitles.*$/i, '')
    .replace(/\s*\|.*$/, '').trim() || 'Unknown Title';

  const thumbnail =
    $('img.wp-post-image, .post-thumbnail img, .item-thumb img, .poster img').first().attr('src') ||
    $('.theiaStickySidebar img, aside img').first().attr('src') || null;

  const description = $('.entry-content > p, .post-content > p, .desc-wrap p, .sinopsis p').first().text().trim() || null;
  const year = $('span.year, .date, time, [itemprop="datePublished"]').first().text().trim() || null;
  const genre = $('a[rel="category tag"], .category a, .genres a').map((_, el) => $(el).text().trim()).get().filter(Boolean).join(', ') || null;

  const qualities = [];
  $('#links .links-table tbody tr').each((_, row) => {
    const $row = $(row);
    const $a = $row.find('a[href]').first();
    const href = $a.attr('href') || '';
    if (!href || !href.startsWith('http')) return;
    const rawQuality = $row.find('.quality, td:nth-child(2)').first().text().trim();
    const rawSize    = $row.find('td:nth-child(3) span, td:nth-child(3)').first().text().trim();
    const server     = $a.text().trim();
    // Build full raw string for parsing
    const rawLabel = [server, rawQuality, rawSize].filter(Boolean).join(' — ');
    const { display, size } = parseQualityLabel(rawLabel);
    if (!qualities.find(q => q.url === href)) {
      qualities.push({ rawLabel, display, size, url: href });
    }
  });

  // Fallback scrape
  if (qualities.length === 0) {
    $('.links-table a[href], .content-links a[href], a[href*="/links/"]').each((_, el) => {
      const $a = $(el);
      const href = ($a.attr('href') || '').startsWith('http') ? $a.attr('href') : BASE_URL + ($a.attr('href') || '');
      const text = $a.text().trim();
      if (href && text && !qualities.find(q => q.url === href)) {
        const { display, size } = parseQualityLabel(text);
        qualities.push({ rawLabel: text, display, size, url: href });
      }
    });
  }

  return { title, url: pageUrl, thumbnail, description, year, genre, qualities };
}

// ── Download & send ───────────────────────────────────────────────────────────
function formatBytes(n) {
  if (!n) return null;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3)   return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function guessFileName(url, title, quality) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (p && p.includes('.')) return decodeURIComponent(p);
  } catch (_) {}
  const safe = (title || 'movie').replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  const q = quality ? `_${quality.replace(/[^a-z0-9]/gi, '')}` : '';
  return `${safe}${q}.mp4`;
}

function guessMime(url, ct) {
  if (ct && ct !== 'application/octet-stream') return ct.split(';')[0].trim();
  if (/\.mkv(\?|$)/i.test(url)) return 'video/x-matroska';
  if (/\.avi(\?|$)/i.test(url)) return 'video/x-msvideo';
  return 'video/mp4';
}

async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
  } catch (_) {}
}

async function sendFilmToChat(sock, chatId, msg, entry) {
  const { url: startUrl, title, quality } = entry;

  await react(sock, msg, '🔗');

  let resolved;
  try {
    resolved = await resolveDownloadUrl(startUrl);
  } catch (_) {
    resolved = { url: startUrl, method: 'link' };
  }

  const { url: dlUrl, method } = resolved;

  // ── Link-only mode (host doesn't support direct streaming) ──
  if (method === 'link') {
    await react(sock, msg, '✅');
    return sock.sendMessage(chatId, {
      text: `✅ *Your download is ready!*\n\n🎬 *${title}*${quality ? ` — ${quality}` : ''}\n\n📲 *Tap the link below to watch or save the film:*\n${dlUrl}\n\n> 🎬 _Infinity MD Mini_`,
    }, { quoted: msg });
  }

  // ── Stream to chat ──
  await react(sock, msg, '📥');
  const headRes = await tryHead(dlUrl);
  const contentLength = headRes.headers?.['content-length'] ? parseInt(headRes.headers['content-length']) : null;
  const contentType   = headRes.headers?.['content-type'] || '';
  const sizeStr = formatBytes(contentLength) || null;

  if (contentLength && contentLength > 1.9 * 1024 * 1024 * 1024) {
    await react(sock, msg, '⚠️');
    return sock.sendMessage(chatId, {
      text: `⚠️ *This film is too large to send directly${sizeStr ? ` (${sizeStr})` : ''}*\n\n📲 Open this link to download it:\n${dlUrl}\n\n> 🎬 _Infinity MD Mini_`,
    }, { quoted: msg });
  }

  try {
    const t0 = Date.now();
    const stream = await axios({
      method: 'GET',
      url: dlUrl,
      responseType: 'stream',
      timeout: 10 * 60 * 1000,
      headers: { ...BROWSER_HEADERS, Accept: '*/*', Referer: BASE_URL },
      maxRedirects: 10,
    });

    const fileName = guessFileName(dlUrl, title, quality);
    const mimetype = guessMime(dlUrl, contentType);

    await sock.sendMessage(chatId, {
      document: stream.data,
      mimetype,
      fileName,
      caption: `🎬 *${title}*${quality ? ` — ${quality}` : ''}${sizeStr ? `\n📦 ${sizeStr}` : ''}\n\n> _Infinity MD Mini_`,
    }, { quoted: msg });

    await react(sock, msg, '✅');

  } catch (err) {
    console.error('[film] stream error:', err?.response?.status || err.message);
    await react(sock, msg, '⚠️');
    return sock.sendMessage(chatId, {
      text: `⚠️ *Couldn't send the film directly*\n\n📲 Use this link to download it instead:\n${dlUrl}\n\n> 🎬 _Infinity MD Mini_`,
    }, { quoted: msg });
  }
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
  name: 'film',
  aliases: ['movie', 'filmsel', 'filmselect', 'filmdown'],
  category: 'media',
  description: 'Search and download movies with Sinhala subtitles',
  usage: 'film <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ── Download to chat ──────────────────────────────────────────────────────
    if (cmdName === 'filmdown') {
      const idx = parseInt(args[0], 10);
      const session = filmDownSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Your session has expired.\n\nSearch again with \`${prefix}film <movie name>\` and pick a result.`,
        }, { quoted: msg });
      }
      await sendFilmToChat(sock, chatId, msg, session[idx]);
      return;
    }

    // ── Pick a search result ──────────────────────────────────────────────────
    if (cmdName === 'filmsel' || cmdName === 'filmselect') {
      const idx = parseInt(args[0], 10);
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
        details = await getMovieDetails(movie.url);
      } catch (err) {
        await react(sock, msg, '❌');
        return sock.sendMessage(chatId, {
          text: `❌ Couldn't load the movie page. Please try again.`,
        }, { quoted: msg });
      }

      if (!details.qualities.length) {
        return sock.sendMessage(chatId, {
          text: `❌ No download options found for *${details.title}*.\n\nThe movie page may not have any links available right now.`,
        }, { quoted: msg });
      }

      // Build quality buttons — deduplicate by resolution if possible
      const seen = new Set();
      const dlSession = [];
      let optNum = 1;
      for (const q of details.qualities.slice(0, 5)) {
        const key = q.display || `Option ${optNum}`;
        if (!seen.has(key)) { seen.add(key); optNum++; }
        dlSession.push({ label: key, quality: q.display, size: q.size, url: q.url, title: details.title });
      }
      setTTL(filmDownSessions, chatId, dlSession);

      let text = `🎬 *${details.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.year)  text += `📅 *Year:* ${details.year}\n`;
      if (details.genre) text += `🎭 *Genre:* ${details.genre}\n`;
      if (details.description) {
        const d = details.description.length > 280 ? details.description.slice(0, 277) + '…' : details.description;
        text += `\n📖 *Story:*\n${d}\n`;
      }
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📥 *Choose a quality to download:*\n\n`;
      dlSession.forEach((q, i) => {
        text += `${i + 1}. *${q.label}*${q.size ? ` — ${q.size}` : ''}\n`;
      });
      text += `\n💡 _Tap a button below to send the film to this chat_\n`;
      text += `> 🎬 _Infinity MD Mini_`;

      const dlBtns = dlSession.map((q, i) => btn(`filmdown_${i}`, `⬇️ ${q.label}`));
      dlBtns.push(btn('film', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • Film Downloader', buttons: dlBtns };
      if (details.thumbnail) payload.image = { url: details.thumbnail };
      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    // ── Search ────────────────────────────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Film Downloader*\n\nUsage: \`${prefix}film <movie name>\`\n\nExample: \`${prefix}film Avengers\`\n\n_Search for any movie and I'll send it directly to this chat._`,
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
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"*.\n\nTry a different spelling or a shorter keyword.`,
      }, { quoted: msg });
    }

    setTTL(filmSessions, chatId, results);

    let text = `🎬 *Film Search Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}`;
      if (m.year) text += ` _(${m.year})_`;
      if (m.quality) text += ` [${m.quality}]`;
      text += `\n`;
    });
    text += `\n💡 *Tap a button to select a movie*\n> 🎬 _Infinity MD Mini_`;

    const pickBtns = results.map((m, i) => btn(`film_pick_${i}`, `${i + 1}. ${m.title.slice(0, 20)}`));
    const thumb = results.find(m => m.thumbnail)?.thumbnail;
    const payload = { text, footer: '♾️ Infinity MD Mini • Film Search', buttons: pickBtns };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
