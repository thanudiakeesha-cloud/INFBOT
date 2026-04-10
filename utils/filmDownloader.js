/**
 * filmDownloader.js
 * Resolves & downloads movie files from various hosting services.
 * Strategy: detect host type → apply correct extraction → download → send as document.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000; // 10 min for large files
const MAX_SIZE = 1.9 * 1024 * 1024 * 1024; // 1.9 GB

function formatBytes(b) {
  if (!b || b <= 0) return '?';
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

function isVideoContentType(ct) {
  return /video|octet-stream|binary/i.test(ct || '');
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
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 20000,
    maxRedirects: 10,
  });
  const $ = cheerio.load(res.data);

  // Try multiple selectors for MediaFire's download button
  const direct =
    $('a#downloadButton').attr('href') ||
    $('a[id="downloadButton"]').attr('href') ||
    $('a.btn-payment-dashboard[href]').attr('href') ||
    $('a[href*="download.mediafire.com"]').first().attr('href') ||
    $('a[href][id*="download"]').first().attr('href') ||
    $('a.btn[href*="mediafire"]').first().attr('href') || null;

  if (direct && direct.startsWith('http')) return direct;

  // Try extracting from JavaScript in the page
  const scriptMatch = res.data.match(/"(https:\/\/download\.mediafire\.com\/[^"]+)"/);
  if (scriptMatch) return scriptMatch[1];

  throw new Error('MediaFire: could not extract direct link');
}

/**
 * TeraBox → direct download URL via their public share API.
 */
async function resolveTeraBox(shareUrl) {
  const normalUrl = shareUrl.replace(/freeterabox\.com|1024terabox\.com|teraboxlink\.com|4funbox\.com|momerybox\.com/, 'teraboxapp.com');

  const surlMatch = normalUrl.match(/[?&]surl=([^&]+)/) || normalUrl.match(/\/s\/([^/?&#]+)/);
  if (!surlMatch) return null;
  const surl = surlMatch[1];

  let cookies = '';
  let jsToken = '';

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

    const jtMatch = pageRes.data.match(/(?:window\.)?jsToken\s*=\s*["']([^"']+)["']/)
      || pageRes.data.match(/fn\("jsToken",\s*"([^"]+)"\)/)
      || pageRes.data.match(/"jsToken"\s*:\s*"([^"]+)"/);
    if (jtMatch) jsToken = jtMatch[1];
  } catch (err) {
    console.error('[terabox] page fetch error:', err.message);
  }

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

/**
 * Follow HTTP redirects and return final URL + headers.
 * Uses GET with range header to avoid loading entire file just for headers.
 */
async function followRedirects(url) {
  // Try HEAD first
  try {
    const res = await axios.head(url, {
      maxRedirects: 15, timeout: 25000,
      headers: { 'User-Agent': UA, Accept: '*/*' },
      validateStatus: s => s < 400,
    });
    const final = res.request?.res?.responseUrl || res.config?.url || url;
    const ct = res.headers['content-type'] || '';
    const cl = parseInt(res.headers['content-length'] || '0', 10);

    // Only trust Content-Length if it's a real file (not HTML redirect page)
    const trustedSize = isVideoContentType(ct) ? cl : 0;

    return {
      finalUrl: final,
      contentType: ct,
      contentLength: trustedSize,
    };
  } catch (_) {}

  // HEAD failed — try GET with Range to get just the headers
  try {
    const res = await axios.get(url, {
      maxRedirects: 15, timeout: 20000,
      headers: { 'User-Agent': UA, Accept: '*/*', Range: 'bytes=0-0' },
      validateStatus: s => s < 400,
      responseType: 'stream',
    });
    // Destroy the stream immediately — we just want headers
    try { res.data.destroy(); } catch (_) {}

    const final = res.request?.res?.responseUrl || url;
    const ct = res.headers['content-type'] || '';
    const cl = parseInt(res.headers['content-range']?.split('/')[1] || res.headers['content-length'] || '0', 10);
    const trustedSize = isVideoContentType(ct) ? cl : 0;

    return { finalUrl: final, contentType: ct, contentLength: trustedSize };
  } catch (_) {
    return { finalUrl: url, contentType: '', contentLength: 0 };
  }
}

/**
 * Scrape a download-page URL and collect all candidate download links.
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
    href = href.split(' ')[0]; // remove trailing spaces
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
  $('a[href*="terabox"], a[href*="4funbox"], a[href*="momerybox"], a[href*="freeterabox"], a[href*="1024terabox"]').each((_, el) =>
    add($(el).attr('href'), 'TeraBox')
  );

  // Generic download buttons / continue links
  const btnSelectors = [
    'a.download-btn', 'a.btn-download', 'a[download]',
    '.wait-done a', 'a.direct-link', '#download a',
    'a[href*="/download/"]', 'a.btn[href*="http"]',
    'a[href*="sinhalasub"], a[href*="cinesubz"]',
  ];
  for (const sel of btnSelectors) {
    $(sel).each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('http')) add(href, $(el).text());
    });
  }

  // Also scan JavaScript for known host URLs
  $('script').each((_, el) => {
    const js = $(el).html() || '';
    const patterns = [
      /["'](https?:\/\/pixeldrain\.com\/u\/[^"'\s]+)["']/g,
      /["'](https?:\/\/drive\.google\.com\/[^"'\s]+)["']/g,
      /["'](https?:\/\/(?:www\.)?mediafire\.com\/[^"'\s]+)["']/g,
      /["'](https?:\/\/(?:www\.)?terabox(?:app)?\.com\/[^"'\s]+)["']/g,
      /["'](https?:\/\/[^"'\s]+\.(?:mp4|mkv|avi|webm)[^"'\s]*)["']/g,
    ];
    for (const pat of patterns) {
      let m;
      while ((m = pat.exec(js)) !== null) {
        add(m[1], 'Script Link');
      }
    }
  });

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
  if (isMega(url) || isOneDrive(url)) return null;
  if (isTeraBox(url)) {
    try {
      const result = await resolveTeraBox(url);
      return result?.url || null;
    } catch (_) { return null; }
  }

  // Unknown: follow redirects, if final URL is a file, use it
  const { finalUrl } = await followRedirects(url);
  if (isDirectFile(finalUrl)) return finalUrl;

  // Last resort: try scraping the page for links
  try {
    const links = await scrapeLinks(url);
    if (links.length > 0) {
      const resolved = await resolveToDownloadable(links[0].url);
      if (resolved) return resolved;
    }
  } catch (_) {}

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * downloadAndSend — resolves multiple candidate links from a page,
 * auto-selects the first server that can deliver the file,
 * downloads it and sends as a WhatsApp document.
 */
async function downloadAndSend(sock, chatId, msg, { title, quality, downloadUrl, fallbackUrls = [] }) {
  const safeTitle = title.replace(/[^\w\s]/g, '').replace(/\s+/g, '_').slice(0, 50);

  const statusMsg = await sock.sendMessage(chatId, {
    text: `⏳ *Preparing movie...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Resolving download server..._`,
  }, { quoted: msg });

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }); } catch (_) {}
  };
  const delStatus = async () => {
    try { await sock.sendMessage(chatId, { delete: statusMsg.key }); } catch (_) {}
  };

  // ── Helper: download using streaming to temp file, then send ────────────────
  const tryDownload = async (dlUrl, hostLabel) => {
    const info = await followRedirects(dlUrl);
    const fileSize = info.contentLength; // 0 if unknown/HTML page
    const fileExt  = ext(info.contentType, dlUrl);
    const fileName = `${safeTitle}.${fileExt}`;

    // Only block if we're confident this is a real video file that's too large
    if (fileSize > MAX_SIZE) {
      await edit(
        `⚠️ *File too large for WhatsApp* (${formatBytes(fileSize)})\n\n` +
        `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
        `🔗 *Direct download link:*\n${dlUrl}\n\n` +
        `> 💡 _Paste this link in your browser to download_`
      );
      return 'too_large';
    }

    const tmpFile = path.join(os.tmpdir(), `film_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`);

    await edit(
      `⬇️ *Downloading from ${hostLabel}...*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
      `📦 *Size:* ${fileSize ? formatBytes(fileSize) : 'Checking...'}\n\n` +
      `_This may take a few minutes for large files..._`
    );

    let downloadedBytes = 0;
    let lastProgressUpdate = Date.now();

    try {
      const response = await axios({
        method: 'GET',
        url: dlUrl,
        responseType: 'stream',
        timeout: DOWNLOAD_TIMEOUT,
        maxRedirects: 15,
        headers: { 'User-Agent': UA, Accept: '*/*' },
      });

      // Check actual content-type from response
      const actualCt = response.headers['content-type'] || '';
      const actualCl = parseInt(response.headers['content-length'] || '0', 10);

      // If response is HTML (redirect/error page), skip this server
      if (actualCt.includes('text/html') && !actualCt.includes('video')) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        return 'failed';
      }

      // If real size is now known and too large, abort
      if (actualCl > MAX_SIZE) {
        response.data.destroy();
        await edit(
          `⚠️ *File too large for WhatsApp* (${formatBytes(actualCl)})\n\n` +
          `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
          `🔗 *Direct download link:*\n${dlUrl}\n\n` +
          `> 💡 _Paste this link in your browser to download_`
        );
        return 'too_large';
      }

      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(tmpFile);
        response.data.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          // Abort if file grows beyond max size
          if (downloadedBytes > MAX_SIZE) {
            response.data.destroy();
            writeStream.destroy();
            reject(new Error('FILE_TOO_LARGE'));
            return;
          }
          // Update progress every 15 seconds for large files
          const now = Date.now();
          if (now - lastProgressUpdate > 15000) {
            lastProgressUpdate = now;
            const known = actualCl || fileSize;
            const pct = known > 0 ? ` (${Math.round((downloadedBytes / known) * 100)}%)` : '';
            edit(
              `⬇️ *Downloading from ${hostLabel}...*\n\n` +
              `🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
              `📦 *Downloaded:* ${formatBytes(downloadedBytes)}${pct}\n\n` +
              `_Please wait..._`
            );
          }
        });
        response.data.on('error', reject);
        response.data.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (err) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      if (err.message === 'FILE_TOO_LARGE') {
        await edit(
          `⚠️ *File too large for WhatsApp*\n\n` +
          `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
          `🔗 *Direct download link:*\n${dlUrl}\n\n` +
          `> 💡 _Paste this link in your browser to download_`
        );
        return 'too_large';
      }
      throw err;
    }

    // Read the downloaded file
    let buffer;
    try {
      buffer = fs.readFileSync(tmpFile);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }

    const mimeType = info.contentType.includes('video') ? info.contentType.split(';')[0].trim() : 'video/mp4';

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

  const allSourceUrls = [downloadUrl, ...fallbackUrls].filter(Boolean);
  let lastLink = downloadUrl;

  await edit(`🔍 *Scanning download servers...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}`);

  for (let si = 0; si < allSourceUrls.length; si++) {
    const srcUrl = allSourceUrls[si];

    let candidates = await scrapeLinks(srcUrl);
    if (!candidates.length) candidates = [{ url: srcUrl, label: 'Direct' }];

    if (si === 0) lastLink = candidates[0]?.url || srcUrl;

    for (const candidate of candidates.slice(0, 8)) {
      let hostLabel;
      try { hostLabel = candidate.label || new URL(candidate.url).hostname; } catch (_) { hostLabel = candidate.label || 'Server'; }

      await edit(
        `🔗 *Trying server:* ${hostLabel}\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Please wait..._`
      );

      let dlUrl = null;
      try { dlUrl = await resolveToDownloadable(candidate.url); } catch (_) {}

      if (!dlUrl) {
        console.log(`[film] could not resolve: ${candidate.url}`);
        continue;
      }

      try {
        const result = await tryDownload(dlUrl, hostLabel);
        if (result === 'ok') return;
        if (result === 'too_large') return;
        // result === 'failed' → try next
      } catch (dlErr) {
        console.error(`[film] download failed from ${hostLabel}:`, dlErr.message);
      }
    }
  }

  // All servers exhausted
  await edit(
    `⚠️ *Could not auto-download this file.*\n\n` +
    `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
    `🔗 *Copy this link to download manually:*\n${lastLink}\n\n` +
    `> 💡 _Paste the link in your browser_\n> 🎬 _Infinity MD Mini_`
  );
}

module.exports = { downloadAndSend, scrapeLinks, resolveToDownloadable };
