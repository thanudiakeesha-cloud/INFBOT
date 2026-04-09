/**
 * filmDownloader.js
 * Resolves & downloads movie files from various hosting services.
 * Strategy: detect host type → apply correct extraction → download → send as document.
 */

const axios   = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DOWNLOAD_TIMEOUT = 8 * 60 * 1000; // 8 min for large files
const MAX_SIZE = 1.9 * 1024 * 1024 * 1024; // 1.9 GB

function formatBytes(b) {
  if (!b) return '?';
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  return (b / 1e6).toFixed(1) + ' MB';
}

function ext(ct, url) {
  const c = (ct || '').toLowerCase();
  for (const e of ['mp4','mkv','avi','webm','mov','m4v']) {
    if (c.includes(e) || url.toLowerCase().includes('.' + e)) return e;
  }
  return 'mp4';
}

// ── Host detectors ────────────────────────────────────────────────────────────

function isGDrive(url)     { return /drive\.google\.com|docs\.google\.com/.test(url); }
function isMega(url)       { return /mega\.nz|mega\.co\.nz/.test(url); }
function isMediaFire(url)  { return /mediafire\.com/.test(url); }
function isTeraBox(url)    { return /terabox\.com|4funbox\.com|momerybox\.com|teraboxapp\.com|freeterabox\.com|1024terabox\.com|teraboxlink\.com/.test(url); }
function isOneDrive(url)   { return /onedrive\.live\.com|1drv\.ms/.test(url); }
function isPixelDrain(url) { return /pixeldrain\.com/.test(url); }
function isDirectFile(url) { return /\.(mp4|mkv|avi|webm|mov|m4v)(\?|$)/i.test(url); }

// ── Per-host resolvers ────────────────────────────────────────────────────────

/** Google Drive → direct download URL */
function gdriveDirectUrl(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=download&confirm=t&id=${m[1]}`;
  const m2 = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/uc?export=download&confirm=t&id=${m2[1]}`;
  return null;
}

/** PixelDrain → direct download */
function pixeldrainDirectUrl(url) {
  const m = url.match(/pixeldrain\.com\/u\/([a-zA-Z0-9]+)/);
  if (m) return `https://pixeldrain.com/api/file/${m[1]}?download`;
  return null;
}

/** MediaFire → scrape the direct download link */
async function resolveMediaFire(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA }, timeout: 20000, maxRedirects: 10,
  });
  const $ = cheerio.load(res.data);
  const direct =
    $('a#downloadButton').attr('href') ||
    $('a.btn-payment-dashboard[href]').attr('href') ||
    $('a[href*="download.mediafire.com"]').first().attr('href') ||
    $('a[href][id*="download"]').first().attr('href') || null;
  if (direct && direct.startsWith('http')) return direct;
  throw new Error('MediaFire: could not extract direct link');
}

/**
 * TeraBox → direct download URL via their public share API.
 * Flow: extract surl → fetch page for cookies → call shorturlinfo API →
 *       call share/download API → get dlink (CDN URL).
 */
async function resolveTeraBox(shareUrl) {
  // Normalize to main domain
  const normalUrl = shareUrl.replace(/freeterabox\.com|1024terabox\.com|teraboxlink\.com|4funbox\.com|momerybox\.com/, 'teraboxapp.com');

  // Extract surl (short URL code)
  const surlMatch = normalUrl.match(/[?&]surl=([^&]+)/) || normalUrl.match(/\/s\/([^/?&#]+)/);
  if (!surlMatch) return null;
  const surl = surlMatch[1];

  let cookies = '';
  let jsToken = '';

  // Step 1: Load the share page to grab cookies + jsToken
  try {
    const pageRes = await axios.get(normalUrl, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
      maxRedirects: 10,
    });
    const setCookies = pageRes.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');

    // Extract jsToken from page HTML
    const jtMatch = pageRes.data.match(/(?:window\.)?jsToken\s*=\s*["']([^"']+)["']/)
      || pageRes.data.match(/fn\("jsToken",\s*"([^"]+)"\)/)
      || pageRes.data.match(/"jsToken"\s*:\s*"([^"]+)"/);
    if (jtMatch) jsToken = jtMatch[1];
  } catch (err) {
    console.error('[terabox] page fetch error:', err.message);
  }

  // Step 2: Get file list from shorturlinfo API
  let shareid, uk, sign, timestamp, fsId, filename, fileSize;
  try {
    const infoRes = await axios.get('https://www.terabox.com/api/shorturlinfo', {
      params: { app_id: 250528, shorturl: surl, root: 1, web: 1, channel: 'dubox', clienttype: 0, jsToken },
      headers: {
        'User-Agent': UA,
        'Cookie': cookies,
        'Referer': normalUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 15000,
    });

    const data = infoRes.data;
    if (data.errno !== 0) {
      console.error('[terabox] shorturlinfo errno:', data.errno, data.errmsg);
      return null;
    }

    const file = data.list?.[0];
    if (!file) return null;

    fsId      = file.fs_id;
    filename  = file.server_filename;
    fileSize  = file.size;
    shareid   = data.shareid;
    uk        = data.uk;
    sign      = data.sign;
    timestamp = data.timestamp;
  } catch (err) {
    console.error('[terabox] shorturlinfo error:', err.message);
    return null;
  }

  // Step 3: Get the actual download dlink
  try {
    const dlRes = await axios.get('https://www.terabox.com/share/download', {
      params: {
        app_id: 250528,
        channel: 'dubox',
        clienttype: 0,
        web: 1,
        jsToken,
        'dp-logid': '',
        shareid,
        uk,
        primaryid: fsId,
        fid_list: `[${fsId}]`,
        sign,
        timestamp,
      },
      headers: {
        'User-Agent': UA,
        'Cookie': cookies,
        'Referer': normalUrl,
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const dlink = dlRes.data?.dlink;
    if (dlink && dlink.startsWith('http')) {
      return { url: dlink, filename, size: fileSize };
    }
  } catch (err) {
    console.error('[terabox] download API error:', err.message);
  }

  return null;
}

/** Follow HTTP redirects and return final URL + headers */
async function followRedirects(url) {
  try {
    const res = await axios.head(url, {
      maxRedirects: 15, timeout: 25000,
      headers: { 'User-Agent': UA, Accept: '*/*' },
      validateStatus: s => s < 400,
    });
    const final = res.request?.res?.responseUrl || res.config?.url || url;
    return {
      finalUrl: final,
      contentType:   res.headers['content-type']   || '',
      contentLength: parseInt(res.headers['content-length'] || '0', 10),
    };
  } catch (_) {
    return { finalUrl: url, contentType: '', contentLength: 0 };
  }
}

/**
 * Scrape a download-page URL and collect all candidate download links.
 * Returns array of { url, label } sorted by priority (direct files first).
 */
async function scrapeLinks(pageUrl) {
  let html;
  try {
    const res = await axios.get(pageUrl, {
      headers: { 'User-Agent': UA, Referer: new URL(pageUrl).origin },
      timeout: 20000, maxRedirects: 10,
    });
    html = res.data;
  } catch (_) { return []; }

  const $ = cheerio.load(html);
  const found = [];
  const seen  = new Set();

  const add = (href, label = '') => {
    if (!href || !href.startsWith('http')) return;
    if (seen.has(href)) return;
    seen.add(href);
    found.push({ url: href, label: label.trim() });
  };

  // Direct video file links
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (isDirectFile(href)) add(href, $(el).text());
  });

  // PixelDrain
  $('a[href*="pixeldrain.com"]').each((_, el) => add($(el).attr('href'), 'PixelDrain'));

  // Google Drive
  $('a[href*="drive.google.com"], a[href*="docs.google.com"]').each((_, el) =>
    add($(el).attr('href'), 'Google Drive')
  );

  // MediaFire
  $('a[href*="mediafire.com"]').each((_, el) => add($(el).attr('href'), 'MediaFire'));

  // MEGA
  $('a[href*="mega.nz"], a[href*="mega.co.nz"]').each((_, el) => add($(el).attr('href'), 'MEGA'));

  // TeraBox / similar
  $('a[href*="terabox"], a[href*="4funbox"], a[href*="momerybox"]').each((_, el) =>
    add($(el).attr('href'), 'TeraBox')
  );

  // Generic download buttons / continue links
  const btnSelectors = [
    'a.download-btn', 'a.btn-download', 'a[download]',
    '.wait-done a', 'a.direct-link', '#download a',
    'a[href*="/download/"]', 'a.btn[href*="http"]',
  ];
  for (const sel of btnSelectors) {
    $(sel).each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('http')) add(href, $(el).text());
    });
  }

  // Sort: direct files first, then pixeldrain, then gdrive, then others
  const priority = u => {
    if (isDirectFile(u)) return 0;
    if (isPixelDrain(u)) return 1;
    if (isGDrive(u))     return 2;
    if (isMediaFire(u))  return 3;
    if (isTeraBox(u))    return 4;
    if (isMega(u))       return 5;
    return 6;
  };
  found.sort((a, b) => priority(a.url) - priority(b.url));
  return found;
}

/**
 * Given a candidate URL, resolve it to a directly downloadable URL.
 * Returns null if the host cannot be directly downloaded (MEGA, TeraBox, etc.).
 */
async function resolveToDownloadable(url) {
  if (isDirectFile(url))   return url;
  if (isPixelDrain(url))   return pixeldrainDirectUrl(url) || url;
  if (isGDrive(url)) {
    const direct = gdriveDirectUrl(url);
    return direct || null;
  }
  if (isMediaFire(url)) {
    try { return await resolveMediaFire(url); } catch (_) { return null; }
  }
  if (isMega(url) || isOneDrive(url)) return null; // can't direct-dl
  if (isTeraBox(url)) {
    try {
      const result = await resolveTeraBox(url);
      return result?.url || null;
    } catch (_) { return null; }
  }

  // Unknown: follow redirects, if final URL is a file, use it
  const { finalUrl } = await followRedirects(url);
  if (isDirectFile(finalUrl)) return finalUrl;
  return null; // give up
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * downloadAndSend — resolves multiple candidate links from a page,
 * auto-selects the first server that can deliver the file,
 * downloads it and sends as a WhatsApp document.
 *
 * @param {object} opts
 *   downloadUrl     - primary URL to resolve (sinhalasub /links/ page or resolved host)
 *   fallbackUrls    - optional array of extra URLs to try if primary fails
 *                     (e.g. other quality options from the same movie)
 */
async function downloadAndSend(sock, chatId, msg, { title, quality, downloadUrl, fallbackUrls = [] }) {
  const safeTitle = title.replace(/[^\w\s]/g, '').replace(/\s+/g, '_').slice(0, 50);

  // Show initial status
  const statusMsg = await sock.sendMessage(chatId, {
    text: `⏳ *Preparing movie...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Resolving download server..._`,
  }, { quoted: msg });

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }); } catch (_) {}
  };
  const delStatus = async () => {
    try { await sock.sendMessage(chatId, { delete: statusMsg.key }); } catch (_) {}
  };

  // ── Helper: try to download and send from a resolved direct URL ────────────
  const tryDownload = async (dlUrl, hostLabel) => {
    const info = await followRedirects(dlUrl);
    const fileSize = info.contentLength;
    const fileExt  = ext(info.contentType, dlUrl);
    const fileName = `${safeTitle}.${fileExt}`;

    if (fileSize > MAX_SIZE) {
      await edit(
        `⚠️ *File too large for WhatsApp* (${formatBytes(fileSize)})\n\n` +
        `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
        `🔗 *Direct link:*\n${dlUrl}`
      );
      return 'too_large';
    }

    await edit(
      `⬇️ *Downloading from ${hostLabel}...*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
      `📦 *Size:* ${fileSize ? formatBytes(fileSize) : 'Checking...'}\n\n` +
      `_This may take a moment..._`
    );

    const response = await axios({
      method: 'GET',
      url: dlUrl,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxRedirects: 15,
      headers: { 'User-Agent': UA, Accept: '*/*' },
    });

    const buffer   = Buffer.from(response.data);
    const mimeType = info.contentType.includes('video') ? info.contentType : 'video/mp4';

    await edit(
      `📤 *Sending file...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
      `📦 *Size:* ${formatBytes(buffer.length)}\n\n_Almost done..._`
    );

    await sock.sendMessage(chatId, {
      document: buffer,
      fileName,
      mimetype: mimeType,
      caption:
        `🎬 *${title}*\n` +
        `📊 *Quality:* ${quality}\n` +
        `📦 *Size:* ${formatBytes(buffer.length)}\n` +
        `🖥️ *Server:* ${hostLabel}\n\n> ♾️ _Infinity MD Mini_`,
    }, { quoted: msg });

    await delStatus();
    return 'ok';
  };

  // ── Build the full list of URLs to try (primary + fallbacks) ──────────────
  // Each entry is { url, label } — scrapeLinks will expand each to its candidates.
  const allSourceUrls = [downloadUrl, ...fallbackUrls].filter(Boolean);

  let lastLink = downloadUrl; // fallback link to show at the end if all fail

  // ── Step 1: Scrape the download page for all candidate links ──────────────
  await edit(`🔍 *Scanning download servers...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}`);

  for (let si = 0; si < allSourceUrls.length; si++) {
    const srcUrl = allSourceUrls[si];

    let candidates = await scrapeLinks(srcUrl);
    if (!candidates.length) candidates = [{ url: srcUrl, label: 'Direct' }];

    if (si === 0) lastLink = candidates[0]?.url || srcUrl;

    // ── Step 2: Try each candidate in priority order ────────────────────────
    for (const candidate of candidates.slice(0, 6)) {
      let hostLabel;
      try { hostLabel = candidate.label || new URL(candidate.url).hostname; } catch (_) { hostLabel = candidate.label || 'Server'; }
      await edit(
        `🔗 *Trying server:* ${hostLabel}\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Please wait..._`
      );

      let dlUrl = null;
      try { dlUrl = await resolveToDownloadable(candidate.url); } catch (_) {}

      if (!dlUrl) continue; // This server can't be resolved — try next

      try {
        const result = await tryDownload(dlUrl, hostLabel);
        if (result === 'ok') return;          // ✅ sent
        if (result === 'too_large') return;   // told user, no point continuing
      } catch (dlErr) {
        console.error(`[film] download failed from ${hostLabel}:`, dlErr.message);
        // try next
      }
    }
  }

  // ── All servers exhausted — send best available link ──────────────────────
  await edit(
    `⚠️ *Could not auto-download this file.*\n\n` +
    `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
    `🔗 *Copy this link to download:*\n${lastLink}\n\n` +
    `> 💡 _Paste the link in your browser_`
  );
}

module.exports = { downloadAndSend, scrapeLinks, resolveToDownloadable };
