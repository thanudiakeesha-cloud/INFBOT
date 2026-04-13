/**
 * sinhalasub.js — Shared scraper for Sinhala-subtitled movie sites
 * Primary: cinesubz.net (sinhalasub.lk is Cloudflare-blocked on server-side)
 * Used by both the film3 command and the /terabox web page.
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://cinesubz.net';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*\|\s*(Cinesubz|SinhalaSub|Sinhala Subtitles|Watch Online).*/i, '')
    .replace(/\s*–\s*(Cinesubz|SinhalaSub).*/i, '')
    .replace(/\s*Sinhala Subtitles.*/i, '')
    .split('|')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function isTeraBoxUrl(str) {
  return /terabox\.com|4funbox\.com|momerybox\.com|teraboxapp\.com|freeterabox\.com|1024terabox\.com|teraboxlink\.com/i.test(str || '');
}

function parseQualityText(raw) {
  // "Direct & Telegram Download LinksSD 480P • 909.13 MB • English"
  // Strip the "Direct & Telegram Download Links" prefix and similar noise
  const cleaned = raw
    .replace(/Direct\s*&?\s*Telegram\s*Download\s*Links?/gi, '')
    .replace(/Download\s*Links?/gi, '')
    .trim();

  // Try to extract: quality, size, language
  const qualityMatch = cleaned.match(/(SD\s*\d+P|HD\s*\d+P|\d+P|4K|CAM|HDCAM|WEBRIP|BLURAY|BDRIP)/i);
  const sizeMatch    = cleaned.match(/(\d[\d.,]+\s*(?:GB|MB))/i);
  const langMatch    = cleaned.match(/(English|Tamil|Hindi|Sinhala|Telugu|Malayalam|Korean|Japanese|Chinese|French|Arabic)/i);

  const parts = [];
  if (qualityMatch) parts.push(qualityMatch[1].trim());
  if (sizeMatch)    parts.push(sizeMatch[1].trim());
  if (langMatch)    parts.push(langMatch[1].trim());

  return parts.length ? parts.join(' · ') : (cleaned.slice(0, 60) || 'Download');
}

async function fetchHtml(url, params = {}) {
  const res = await axios.get(url, {
    params,
    headers: { ...HEADERS, Referer: BASE_URL },
    timeout: 20000,
    maxRedirects: 10,
    validateStatus: s => s < 600,
  });

  if (res.status === 403 || res.status === 503 || res.status === 429) {
    const err = new Error('CLOUDFLARE_BLOCKED');
    err.cfBlocked = true;
    throw err;
  }

  const html = typeof res.data === 'string' ? res.data : '';
  if (
    html.includes('Just a moment') ||
    html.includes('cf-browser-verification') ||
    html.includes('checking your browser') ||
    html.includes('Sorry, you have been blocked')
  ) {
    const err = new Error('CLOUDFLARE_BLOCKED');
    err.cfBlocked = true;
    throw err;
  }

  return html;
}

async function searchMovies(query, limit = 8) {
  const html = await fetchHtml(`${BASE_URL}/`, { s: query });
  const $    = cheerio.load(html);
  const results = [];
  const seen    = new Set();

  // cinesubz.net uses .display-item as primary selector
  const selectors = [
    '.display-item', '.item-box', '.module-item', '.ml-item',
    '.post-item', '.movie-item', '.item', '.post', 'article',
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      if (results.length >= limit) return;
      const $el   = $(el);

      // Prefer links with /movies/ in URL
      let $link = $el.find('a[href*="/movies/"]').first();
      if (!$link.length) $link = $el.find('a[href]').first();

      let movieUrl = $link.attr('href') || '';
      if (!movieUrl) return;
      if (!movieUrl.startsWith('http')) movieUrl = BASE_URL + movieUrl;
      if (seen.has(movieUrl)) return;
      seen.add(movieUrl);

      const rawTitle =
        $link.attr('title')?.trim() ||
        $el.find('h3, h2, h1, .title, .entry-title').first().text().trim() || '';
      const title = cleanTitle(rawTitle);
      if (!title || title.length < 3) return;

      const $img = $el.find('img').first();
      const thumbnail =
        $img.attr('data-original') ||
        $img.attr('data-src') ||
        $img.attr('src') || null;

      const quality = $el.find('.quality, .qty, .label-quality').first().text().trim() || null;
      const year    = $el.find('.item-date, time, .year, .movie-year').first().text().trim() || null;

      results.push({
        title,
        url: movieUrl,
        thumbnail: (thumbnail && thumbnail.startsWith('http')) ? thumbnail : null,
        quality,
        year,
      });
    });
    if (results.length) break;
  }

  return results;
}

const HOSTING_RE = /terabox\.com|4funbox\.com|momerybox\.com|teraboxapp\.com|freeterabox\.com|1024terabox\.com|teraboxlink\.com|mediafire\.com|pixeldrain\.com|mega\.nz|drive\.google\.com|1drv\.ms|onedrive\.live\.com/i;

async function followDownloadGateway(gatewayUrl) {
  try {
    const html = await fetchHtml(gatewayUrl);
    const $    = cheerio.load(html);
    const found = [];
    const seen  = new Set();

    const addLink = (href, label) => {
      if (!href || !href.startsWith('http') || seen.has(href)) return;
      seen.add(href);
      found.push({ url: href, label: (label || '').trim() });
    };

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (HOSTING_RE.test(href)) addLink(href, $(el).text().trim());
    });

    $('script').each((_, el) => {
      const js = $(el).html() || '';
      const pat = /["'`](https?:\/\/[^"'`\s]{10,})["'`]/g;
      let m;
      while ((m = pat.exec(js)) !== null) {
        if (HOSTING_RE.test(m[1])) addLink(m[1], 'Script');
      }
    });

    return found;
  } catch (_) {
    return [];
  }
}

async function getMovieDetails(pageUrl) {
  const html = await fetchHtml(pageUrl);
  const $    = cheerio.load(html);

  const rawTitle = $('h1.entry-title, h1.post-title, h1').first().text()
    || $('title').first().text() || '';
  const title = cleanTitle(rawTitle) || 'Unknown Title';

  let thumbnail = null;
  $('img').each((_, el) => {
    if (thumbnail) return;
    const src = $(el).attr('src') || '';
    if (src && src.startsWith('http') && !src.includes('cinesubz.co/wp-content/uploads/2025')) {
      thumbnail = src;
    }
  });

  const description =
    $('.entry-content > p, .post-content > p, .sinopsis p, .description p').first().text().trim() || null;

  const year  = $('span.year, time, [itemprop="datePublished"], .entry-date, .movie-year').first().text().trim() || null;
  const language = $('span.language, [itemprop="inLanguage"], .movie-language').first().text().trim() || null;
  const genreLinks = $('a[rel="category tag"], .genres a, .genre a, .category a');
  const genre = genreLinks.length
    ? genreLinks.map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 5).join(', ')
    : null;

  const qualityMap = new Map();

  const addQuality = (href, label, size = null, priority = 10) => {
    if (!href) return;
    const existing = qualityMap.get(href);
    if (existing && existing.priority <= priority) return;
    const isTB = isTeraBoxUrl(href);
    qualityMap.set(href, { label: label || 'Download', url: href, size, isTeraBox: isTB, priority });
  };

  const intermediateLinks = [];
  const seenIntermediate  = new Set();

  const collectFromPage = ($page, baseLabel = '') => {
    $page('.movie-download-link-item').each((_, item) => {
      const $item = $page(item);
      const $a    = $item.find('a[href]').first();
      const href  = $a.attr('href') || '';
      if (!href) return;
      const rawText = $a.text().trim();
      const label   = parseQualityText(rawText) || baseLabel;
      const sizeM   = rawText.match(/(\d[\d.,]+\s*(?:GB|MB))/i);

      if (HOSTING_RE.test(href)) {
        addQuality(href, label, sizeM ? sizeM[1] : null, 1);
      } else if (href.startsWith('http') && !seenIntermediate.has(href)) {
        seenIntermediate.add(href);
        intermediateLinks.push({ url: href, label });
      }
    });

    $page('a.movie-download-button, a.download-button, a[class*="download"]').each((_, el) => {
      const href = $page(el).attr('href') || '';
      if (!href) return;
      const label = $page(el).closest('[class*="item"],[class*="link"]')
        .find('[class*="meta"],[class*="quality"],span').first().text().trim()
        || $page(el).text().trim() || baseLabel || 'Download';

      if (HOSTING_RE.test(href)) {
        addQuality(href, parseQualityText(label), null, 2);
      } else if (href.startsWith('http') && !seenIntermediate.has(href)) {
        seenIntermediate.add(href);
        intermediateLinks.push({ url: href, label });
      }
    });

    $page('#links .links-table tbody tr, .links-table tbody tr').each((_, row) => {
      const $a   = $page(row).find('a[href]').first();
      const href  = $a.attr('href') || '';
      const qual  = $page(row).find('td:nth-child(2), .quality').first().text().trim();
      const sz    = $page(row).find('td:nth-child(3) span, td:nth-child(3)').first().text().trim();
      const lbl   = $a.text().trim();
      if (!href?.startsWith('http')) return;
      if (HOSTING_RE.test(href)) {
        addQuality(href, qual ? `${lbl} — ${qual}` : lbl, sz || null, 2);
      } else if (!seenIntermediate.has(href)) {
        seenIntermediate.add(href);
        intermediateLinks.push({ url: href, label: lbl });
      }
    });

    $page('a[href]').each((_, el) => {
      const href = $page(el).attr('href') || '';
      const text = $page(el).text().trim();
      if (!href.startsWith('http')) return;
      if (HOSTING_RE.test(href)) {
        addQuality(href, text || baseLabel || 'Download', null, 5);
      }
    });
  };

  collectFromPage($);

  const gatewayResults = await Promise.all(
    intermediateLinks.slice(0, 6).map(({ url, label }) =>
      followDownloadGateway(url).then(links =>
        links.map(l => ({ ...l, label: l.label || label }))
      )
    )
  );

  for (const links of gatewayResults) {
    for (const { url, label } of links) {
      addQuality(url, label, null, 3);
    }
  }

  if (qualityMap.size === 0) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href.startsWith('http') && !href.includes('cinesubz') && !href.includes('sinhalasub') && text.length > 1 && text.length < 100) {
        addQuality(href, text, null, 9);
      }
    });
  }

  const qualities = [...qualityMap.values()];
  qualities.sort((a, b) => {
    if (a.isTeraBox !== b.isTeraBox) return a.isTeraBox ? -1 : 1;
    return a.priority - b.priority;
  });

  return { title, thumbnail, description, year, language, genre, qualities };
}

module.exports = { searchMovies, getMovieDetails, cleanTitle, isTeraBoxUrl, BASE_URL };
