/**
 * Film file downloader — resolves the final direct download URL,
 * downloads the file, and sends it as a WhatsApp document.
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_SIZE_BYTES = 1.9 * 1024 * 1024 * 1024; // 1.9 GB WhatsApp limit
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

/**
 * Follow all redirects and return the final URL + content-type + content-length headers.
 */
async function resolveFinalUrl(url) {
  const response = await axios.head(url, {
    maxRedirects: 15,
    timeout: 30000,
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Referer': new URL(url).origin,
    },
    validateStatus: s => s < 400,
  });

  const finalUrl      = response.request?.res?.responseUrl || response.config?.url || url;
  const contentType   = response.headers['content-type']   || 'video/mp4';
  const contentLength = parseInt(response.headers['content-length'] || '0', 10);
  return { finalUrl, contentType, contentLength };
}

/**
 * Detect file extension from content-type or URL.
 */
function detectExtension(contentType, url) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('mp4'))  return 'mp4';
  if (ct.includes('mkv'))  return 'mkv';
  if (ct.includes('avi'))  return 'avi';
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('mov'))  return 'mov';
  const urlLower = url.toLowerCase();
  for (const ext of ['mp4','mkv','avi','webm','mov','m4v']) {
    if (urlLower.includes(`.${ext}`)) return ext;
  }
  return 'mp4';
}

/**
 * Format bytes to human-readable.
 */
function formatBytes(bytes) {
  if (!bytes) return 'Unknown size';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

/**
 * Attempt to resolve the real direct download URL from a download page.
 * Many sites use intermediate pages with buttons/links to the actual file.
 */
async function resolveFromPage(pageUrl) {
  try {
    const cheerio = require('cheerio');
    const res = await axios.get(pageUrl, {
      maxRedirects: 10,
      timeout: 20000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': new URL(pageUrl).origin,
      },
      validateStatus: s => s < 500,
    });

    const $ = cheerio.load(res.data);
    const candidates = [];

    // Look for direct file links (.mp4, .mkv, etc.)
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/\.(mp4|mkv|avi|webm|mov|m4v)(\?|$)/i.test(href)) {
        candidates.push(href.startsWith('http') ? href : new URL(href, pageUrl).href);
      }
    });

    // Look for download/continue buttons
    if (!candidates.length) {
      const selectors = [
        'a.download-btn[href]', 'a.btn-download[href]', 'a[download][href]',
        '.wait-done a[href]', 'a.direct-link[href]', '#download a[href]',
        'a[href*="drive.google.com"]', 'a[href*="mega.nz"]',
        'a[href*="terabox"]', 'a[href*="1fichier"]',
        'a[href*="mediafire"]', 'a[href*="zippyshare"]',
      ];
      for (const sel of selectors) {
        $(sel).each((_, el) => {
          const href = $(el).attr('href') || '';
          if (href && href.startsWith('http') && !href.includes('sinhalasub') && !href.includes('cinesubz') && !href.includes('srihub')) {
            candidates.push(href);
          }
        });
      }
    }

    if (candidates.length) return candidates[0];
  } catch (_) {}
  return null;
}

/**
 * Main function: resolve + download + send as WhatsApp document.
 * Falls back to sending the link as text if download fails.
 */
async function downloadAndSend(sock, chatId, msg, { title, quality, downloadUrl }) {
  const prefix = '🎬';

  // Step 1: Notify user we're working on it
  const processingMsg = await sock.sendMessage(chatId, {
    text: `⏳ *Preparing your movie...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Resolving download link..._`,
  }, { quoted: msg });

  const editStatus = async (text) => {
    try {
      await sock.sendMessage(chatId, {
        text,
        edit: processingMsg.key,
      });
    } catch (_) {}
  };

  let finalUrl = downloadUrl;

  // Step 2: Try to resolve the final direct URL from the page
  try {
    await editStatus(`⏳ *Preparing your movie...*\n\n🎬 *${title}*\n📊 *Quality:* ${quality}\n\n_Resolving final download URL..._`);
    const resolved = await resolveFromPage(downloadUrl);
    if (resolved) finalUrl = resolved;
  } catch (_) {}

  // Step 3: Resolve redirect chain to get true final URL + file info
  let contentType = 'video/mp4';
  let contentLength = 0;

  try {
    const info = await resolveFinalUrl(finalUrl);
    finalUrl      = info.finalUrl;
    contentType   = info.contentType;
    contentLength = info.contentLength;
  } catch (_) {}

  const ext      = detectExtension(contentType, finalUrl);
  const sizeStr  = formatBytes(contentLength);
  const fileName = `${title.replace(/[^\w\s]/g, '').replace(/\s+/g, '_').slice(0, 50)}.${ext}`;

  // Step 4: Check if it's a known cloud storage (can't stream directly)
  const isCloudStorage = /drive\.google|mega\.nz|terabox|1fichier|mediafire|zippyshare|wetransfer/i.test(finalUrl);
  if (isCloudStorage) {
    await editStatus(
      `⚠️ *This movie is hosted on cloud storage.*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
      `🔗 *Direct Link:*\n${finalUrl}\n\n` +
      `> 💡 _Paste this link in your browser to download_`
    );
    return;
  }

  // Step 5: Check size — if unknown or huge, just send the link
  if (contentLength > MAX_SIZE_BYTES) {
    await editStatus(
      `⚠️ *File too large to send via WhatsApp (${sizeStr})*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
      `🔗 *Direct Download Link:*\n${finalUrl}\n\n` +
      `> 💡 _Paste this link in your browser to download_`
    );
    return;
  }

  // Step 6: Download the file
  try {
    await editStatus(
      `⬇️ *Downloading movie file...*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
      `📦 *Size:* ${sizeStr}\n\n` +
      `_Please wait, this may take a moment..._`
    );

    const response = await axios({
      method: 'GET',
      url: finalUrl,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirects: 15,
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': new URL(finalUrl).origin,
      },
      onDownloadProgress: () => {},
    });

    const buffer = Buffer.from(response.data);
    const actualSize = formatBytes(buffer.length);

    await editStatus(
      `📤 *Sending movie file...*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n` +
      `📦 *Size:* ${actualSize}\n\n` +
      `_Almost done..._`
    );

    // Step 7: Send as document
    await sock.sendMessage(chatId, {
      document: buffer,
      fileName,
      mimetype: contentType.includes('video') ? contentType : 'video/mp4',
      caption:
        `🎬 *${title}*\n` +
        `📊 *Quality:* ${quality}\n` +
        `📦 *Size:* ${actualSize}\n\n` +
        `> ♾️ _Infinity MD Mini_`,
    }, { quoted: msg });

    // Delete the processing message
    try {
      await sock.sendMessage(chatId, { delete: processingMsg.key });
    } catch (_) {}

  } catch (err) {
    // Fallback: send the link
    await editStatus(
      `⚠️ *Could not download the file automatically.*\n\n` +
      `🎬 *${title}*\n📊 *Quality:* ${quality}\n\n` +
      `🔗 *Direct Download Link:*\n${finalUrl}\n\n` +
      `> 💡 _Paste this link in your browser to download_`
    );
  }
}

module.exports = { downloadAndSend, resolveFromPage, resolveFinalUrl };
