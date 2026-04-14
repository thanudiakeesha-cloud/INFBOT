const { cmd } = require("../../command");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { pipeline } = require("stream/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const { sendBtn, btn } = require("../../utils/sendBtn");

// Patch Baileys upload timeout from 30s → 30 minutes so large files can upload
try {
  const baileys = require("@whiskeysockets/baileys");
  if (baileys.UPLOAD_TIMEOUT !== undefined) baileys.UPLOAD_TIMEOUT = 30 * 60 * 1000;
} catch (_) {}

// Global State (separate namespace from film.js)
global.pendingMovie2 = global.pendingMovie2 || {};
global.activeMovieDownloads2 = global.activeMovieDownloads2 || new Set();
global.movieDownloadQueue2 = global.movieDownloadQueue2 || [];

// Config
const BASE_URL = "https://baiscopedownloads.link";
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";

const DOWNLOAD_HIGH_WATER_MARK = 2 * 1024 * 1024;
const MAX_MOVIE_DOWNLOADS2 = Math.max(1, Number(process.env.MAX_MOVIE_DOWNLOADS) || 1);
const MOVIE_UPLOAD_MAX_MB2 = Math.max(10, Number(process.env.MOVIE_UPLOAD_MAX_MB) || 64);
const MOVIE_UPLOAD_MAX_BYTES2 = MOVIE_UPLOAD_MAX_MB2 * 1024 * 1024;

const downloadHttpAgent2 = new http.Agent({ keepAlive: true, maxSockets: 8 });
const downloadHttpsAgent2 = new https.Agent({ keepAlive: true, maxSockets: 8 });

// Only codetabs reliably bypasses Cloudflare protection for this site
const PROXY_POOL = [
  { build: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
  { build: url => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}` },
];
const proxyCooldown2 = new Array(PROXY_POOL.length).fill(0);
const PROXY_COOLDOWN_MS = 90 * 1000;

// 5-minute response cache to reduce proxy load
const proxyCache2 = new Map();
const PROXY_CACHE_TTL = 5 * 60 * 1000;

// Download host labels for display
const HOST_LABELS = {
  "usersdrive": "🟢 UsersDrive",
  "dgdrive": "🔵 DGDrive",
  "filepv": "🟣 FilePV",
  "bysezoxexe": "🟣 FilePV",
  "mega.nz": "🟠 MEGA",
  "mediafire": "🟡 Mediafire",
  "drive.google": "🔵 Google Drive",
  "tinyurl": "🔗 TinyURL",
  "send.now": "📤 Send.now",
  "ouo.io": "🔗 Mirror Link",
  "1fichier": "🟤 1Fichier",
};

// Quality sort order (higher = better)
const QUALITY_ORDER = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2 };

// ─── Proxy Helpers ────────────────────────────────────────────────────────────
async function proxyFetch2(url, retries = 3) {
  const cached = proxyCache2.get(url);
  if (cached && Date.now() < cached.expiry) {
    return cached.response;
  }

  let lastError;
  const now = () => Date.now();
  let realAttempts = 0;
  let proxySkips = 0;

  while (realAttempts < retries) {
    let proxyIndex = proxyCooldown2.findIndex(until => now() >= until);
    if (proxyIndex === -1) {
      proxyIndex = proxyCooldown2.indexOf(Math.min(...proxyCooldown2));
      const wait = Math.max(0, proxyCooldown2[proxyIndex] - now());
      console.warn(`[film2] All proxies cooling down — waiting ${Math.ceil(wait / 1000)}s...`);
      await new Promise(r => setTimeout(r, wait));
    }

    const proxy = PROXY_POOL[proxyIndex];
    try {
      const response = await axios.get(proxy.build(url), {
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        validateStatus: () => true,
        decompress: true
      });

      if (response.status === 429 || response.status === 403) {
        proxyCooldown2[proxyIndex] = now() + PROXY_COOLDOWN_MS;
        console.warn(`[film2] Proxy #${proxyIndex} returned ${response.status} — cooling down ${PROXY_COOLDOWN_MS / 1000}s`);
        lastError = new Error(`Proxy returned ${response.status} — please try again in a moment.`);
        proxySkips++;
        if (proxySkips > PROXY_POOL.length) {
          realAttempts++;
          proxySkips = 0;
        }
        continue;
      }

      if (response.status >= 400) {
        throw new Error(`Proxy returned HTTP ${response.status}`);
      }

      proxyCache2.set(url, { response, expiry: now() + PROXY_CACHE_TTL });
      return response;
    } catch (err) {
      lastError = err;
      realAttempts++;
      if (realAttempts < retries) {
        await new Promise(r => setTimeout(r, 2000 * realAttempts));
      }
    }
  }
  throw lastError;
}

function getHostLabel(url) {
  for (const [key, label] of Object.entries(HOST_LABELS)) {
    if (url.includes(key)) return label;
  }
  return "⬇️ Download";
}

function isExternalDownloadLink(url) {
  if (!url || !url.startsWith("http")) return false;
  const blocked = [
    "baiscopedownloads.link", "baiscope.lk", "youtube.com", "youtu.be",
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
    "wikipedia.org", "justpaste.it", "wp-content", "fonts.g"
  ];
  return !blocked.some(b => url.includes(b));
}

// ─── Download / Progress Helpers ──────────────────────────────────────────────
function formatBytes2(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatEta2(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

function renderProgressBar2(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const width = 20;
  const filled = Math.round((safePercent / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${safePercent}%`;
}

function renderMovieProgress2({ title, quality, size, downloadPercent, uploadPercent, stage, downloadedBytes, totalBytes, speedBytesPerSecond, startedAt }) {
  const safeDownloadPercent = downloadPercent ?? 0;
  const safeUploadPercent = uploadPercent ?? 0;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  const downloaded = formatBytes2(downloadedBytes);
  const total = formatBytes2(totalBytes);
  const speed = formatBytes2(speedBytesPerSecond);

  let eta = "";
  if (speedBytesPerSecond > 0 && totalBytes > 0 && downloadedBytes > 0 && safeDownloadPercent < 100) {
    eta = formatEta2((totalBytes - downloadedBytes) / speedBytesPerSecond);
  }

  const progressLine = downloaded && total
    ? `${downloaded} / ${total}${speed ? "  •  " + speed + "/s" : ""}${eta ? "  •  ⏳ " + eta : ""}`
    : size;

  const isUploading = safeDownloadPercent >= 100;

  return (
    `╭─────────────────────────╮\n` +
    `│  📥 *Downloading Movie*\n` +
    `│\n` +
    `│  🎬 ${title}\n` +
    `│  📊 ${quality}  •  ${size}\n` +
    `│\n` +
    (isUploading
      ? `│  ⬆️ *Sending to chat...*\n` +
        `│  ${renderProgressBar2(safeUploadPercent)}\n`
      : `│  ⬇️ *Downloading...*\n` +
        `│  ${renderProgressBar2(safeDownloadPercent)}\n` +
        (progressLine ? `│  ${progressLine}\n` : "")
    ) +
    `│\n` +
    `│  ⏱️ ${elapsedSeconds}s  •  ${stage}\n` +
    `╰─────────────────────────╯`
  );
}

async function sendLiveProgress2(sock, chatId, quoted, initialState) {
  let state = { startedAt: Date.now(), ...initialState };
  let stopped = false;
  let editing = false;
  let lastText = "";
  const message = await sock.sendMessage(chatId, { text: renderMovieProgress2(state) }, { quoted });

  const edit = async (force = false) => {
    if (stopped || !message?.key) return;
    if (editing) {
      if (!force) return;
      while (editing) await new Promise(resolve => setTimeout(resolve, 100));
      if (stopped) return;
    }
    editing = true;
    try {
      const text = renderMovieProgress2(state);
      if (force || text !== lastText) {
        lastText = text;
        await sock.sendMessage(chatId, { text, edit: message.key });
      }
    } catch (e) {
      console.error("[film2] Progress edit error:", e.message);
    } finally {
      editing = false;
    }
  };

  lastText = renderMovieProgress2(state);
  const timer = setInterval(edit, 1000);

  return {
    update(nextState) {
      state = { ...state, ...nextState };
    },
    async stop(finalState) {
      state = { ...state, ...finalState };
      clearInterval(timer);
      await edit(true);
      stopped = true;
    }
  };
}

async function downloadMovieToFile2(url, tempPath, onProgress) {
  // HEAD check first: validate the URL before streaming
  try {
    const headRes = await axios.head(url, {
      timeout: 20000,
      maxRedirects: 10,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
      },
      validateStatus: () => true
    });
    const headCt = (headRes.headers["content-type"] || "").toLowerCase();
    if (headRes.status === 404 || headRes.status === 410) {
      throw new Error(`HTTP_${headRes.status}`);
    }
    if (headCt.includes("text/html")) {
      throw new Error("REQUIRES_PAGE");
    }
  } catch (headErr) {
    if (headErr.message === "REQUIRES_PAGE" || headErr.message.startsWith("HTTP_")) throw headErr;
    // HEAD itself failed (network error, server doesn't support HEAD) — try GET anyway
  }

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: 0,
    maxRedirects: 10,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    decompress: false,
    httpAgent: downloadHttpAgent2,
    httpsAgent: downloadHttpsAgent2,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Connection": "keep-alive",
    },
    validateStatus: status => {
      if (status === 404 || status === 410) throw Object.assign(new Error(`HTTP_${status}`), { code: `HTTP_${status}` });
      return status >= 200 && status < 400;
    }
  });

  const contentType = (response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error("REQUIRES_PAGE");
  }

  const totalBytes = Number(response.headers["content-length"]) || 0;
  const startedAt = Date.now();
  let downloadedBytes = 0;
  let lastProgressAt = 0;

  const { Transform } = require("stream");
  const progressTransform = new Transform({
    highWaterMark: DOWNLOAD_HIGH_WATER_MARK,
    transform(chunk, encoding, callback) {
      downloadedBytes += chunk.length;
      const now = Date.now();
      if (now - lastProgressAt >= 250 || downloadedBytes === totalBytes) {
        lastProgressAt = now;
        const seconds = Math.max(1, (now - startedAt) / 1000);
        const percent = totalBytes
          ? Math.min(85, (downloadedBytes / totalBytes) * 85)
          : Math.min(85, 5 + (downloadedBytes / (1024 * 1024 * 1024)) * 80);
        onProgress({
          downloadPercent: percent,
          downloadedBytes,
          totalBytes,
          speedBytesPerSecond: downloadedBytes / seconds
        });
      }
      callback(null, chunk);
    }
  });

  await pipeline(
    response.data,
    progressTransform,
    fs.createWriteStream(tempPath, { highWaterMark: DOWNLOAD_HIGH_WATER_MARK })
  );

  const savedSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
  if (!savedSize) {
    throw new Error("Downloaded file is empty. The link may be expired or the file was removed.");
  }

  return { downloadedBytes: savedSize, totalBytes: totalBytes || savedSize };
}

async function splitVideoWithFfmpeg2(inputPath, partCount, baseTitle) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet", "-print_format", "json", "-show_format", inputPath
  ]);
  const info = JSON.parse(stdout);
  const duration = parseFloat(info.format.duration);
  const partDuration = duration / partCount;
  const partPaths = [];

  for (let i = 0; i < partCount; i++) {
    const startTime = i * partDuration;
    const partPath = `/tmp/bs_part${String(i + 1).padStart(2, "0")}of${String(partCount).padStart(2, "0")}_${Date.now()}.mp4`;
    await execFileAsync("ffmpeg", [
      "-ss", String(startTime), "-i", inputPath,
      "-t", String(partDuration), "-c", "copy",
      "-avoid_negative_ts", "1", "-y", partPath
    ], { maxBuffer: 10 * 1024 * 1024 });
    partPaths.push(partPath);
  }
  return partPaths;
}

async function copyRangeToPart2(sourcePath, partPath, start, end) {
  await pipeline(
    fs.createReadStream(sourcePath, { start, end, highWaterMark: DOWNLOAD_HIGH_WATER_MARK }),
    fs.createWriteStream(partPath, { highWaterMark: DOWNLOAD_HIGH_WATER_MARK })
  );
}

async function sendSplitMovieParts2(sock, chatId, quoted, sourcePath, baseFileName, baseCaption, totalSize, progress) {
  const bytesPerPart = MOVIE_UPLOAD_MAX_BYTES2;
  const partCount = Math.ceil(totalSize / bytesPerPart);
  const partPaths = [];
  let uploadTimer = null;

  try {
    await sock.sendMessage(chatId, {
      text:
        `╭─────────────────────────╮\n` +
        `│  📦 *Sending in ${partCount} Parts*\n` +
        `│\n` +
        `│  Each part: ~${formatBytes2(bytesPerPart)}\n` +
        `│\n` +
        `│  ⚠️ *How to watch:*\n` +
        `│  1. Download all ${partCount} parts\n` +
        `│  2. Join them using HJSplit (Windows)\n` +
        `│     or: cat part1 part2 > movie.mp4\n` +
        `│  3. Open the joined .mp4 file\n` +
        `╰─────────────────────────╯`
    }, { quoted });

    for (let index = 0; index < partCount; index++) {
      const partNumber = index + 1;
      const start = index * bytesPerPart;
      const end = Math.min(totalSize - 1, start + bytesPerPart - 1);
      const partPath = `${sourcePath}.part${String(partNumber).padStart(2, "0")}of${String(partCount).padStart(2, "0")}`;
      const partFileName = `${baseFileName}.part${String(partNumber).padStart(2, "0")}of${String(partCount).padStart(2, "0")}`;
      partPaths.push(partPath);

      const basePercent = Math.round((index / partCount) * 100);
      let prepPercent = basePercent;
      progress.update({ uploadPercent: prepPercent, stage: `Preparing part ${partNumber}/${partCount}...` });

      const prepTimer = setInterval(() => {
        prepPercent = Math.min(basePercent + Math.round(100 / partCount) - 2, prepPercent + 1);
        progress.update({ uploadPercent: prepPercent, stage: `Preparing part ${partNumber}/${partCount}...` });
      }, 400);

      await copyRangeToPart2(sourcePath, partPath, start, end);
      clearInterval(prepTimer);

      let currentPartPercent = 0;
      uploadTimer = setInterval(() => {
        currentPartPercent = Math.min(95, currentPartPercent + 2);
        const totalUploadPercent = ((index + currentPartPercent / 100) / partCount) * 100;
        progress.update({
          uploadPercent: totalUploadPercent,
          stage: `Uploading part ${partNumber}/${partCount} to chat...`
        });
      }, 1000);

      await sock.sendMessage(chatId, {
        document: { url: partPath },
        mimetype: "application/octet-stream",
        fileName: partFileName,
        caption:
          `${baseCaption}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 Part *${partNumber} of ${partCount}*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `_Download all ${partCount} parts and join them before watching._`
      }, { quoted });

      clearInterval(uploadTimer);
      uploadTimer = null;
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      progress.update({
        uploadPercent: Math.round((partNumber / partCount) * 100),
        stage: `Part ${partNumber}/${partCount} sent.`
      });
    }
  } finally {
    if (uploadTimer) clearInterval(uploadTimer);
    for (const p of partPaths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}

// ─── Puppeteer-based URL resolver ─────────────────────────────────────────────
const CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium-browser";

// CDN/direct download patterns — if any intercepted URL matches, it's the file
const CDN_PATTERNS = [
  /\.(mp4|mkv|avi|mov|webm)(\?|$)/i,
  /content-disposition.*attachment/i,
  /\/storage\/[a-z0-9]+\//i,
  /\/files\/[a-z0-9]+\//i,
  /\/dl\/[a-z0-9]+/i,
  /cdnfile|filecdn|cdn\d+\./i,
];

const BLOCKED_CDN_DOMAINS = [
  "googlesyndication", "googletagmanager", "doubleclick", "facebook.net",
  "twitter.com", "youtube.com", "pubadx", "adnxs", "adsystem"
];

async function resolveWithPuppeteer(pageUrl) {
  let browser = null;
  try {
    const puppeteer = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    puppeteer.use(StealthPlugin());

    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run", "--no-zygote", "--single-process"
      ],
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 720 });

    // Intercept network to catch direct file URLs
    let resolvedUrl = null;
    const seenUrls = new Set();

    await page.setRequestInterception(true);
    page.on("request", req => {
      const u = req.url();
      // Block ad/tracker domains
      if (BLOCKED_CDN_DOMAINS.some(d => u.includes(d))) {
        req.abort();
        return;
      }
      // Sniff requests that look like direct file downloads
      if (!resolvedUrl && CDN_PATTERNS.some(p => p.test(u)) && !seenUrls.has(u)) {
        resolvedUrl = u;
        console.log("[film2][puppeteer] Caught file URL via request sniff:", u.substring(0, 100));
      }
      req.continue();
    });

    page.on("response", async res => {
      const url = res.url();
      if (resolvedUrl || seenUrls.has(url)) return;
      seenUrls.add(url);

      const ct = res.headers()["content-type"] || "";
      const cl = parseInt(res.headers()["content-length"] || "0", 10);
      const cd = res.headers()["content-disposition"] || "";

      // A large binary or explicit attachment = the file
      if (
        ct.includes("video/") ||
        ct.includes("application/octet-stream") ||
        ct.includes("application/force-download") ||
        cd.includes("attachment") ||
        (cl > 10 * 1024 * 1024) // >10 MB
      ) {
        resolvedUrl = url;
        console.log("[film2][puppeteer] Caught file URL via response intercept:", url.substring(0, 100));
      }
    });

    // Navigate to the download page
    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      // timeout is OK — we may already have the URL
    }

    if (resolvedUrl) return resolvedUrl;

    // Wait a moment for JS to run
    await new Promise(r => setTimeout(r, 3000));
    if (resolvedUrl) return resolvedUrl;

    // Try clicking download/free download buttons (CSS-only selectors — no jQuery)
    const buttonSelectors = [
      "#downloadbtn",                        // usersdrive countdown page
      "a#dlbutton",
      "a.download-btn",
      "input[value='Free Download']",
      "input[name='method_free']",
      "button[class*='download']",
      "a[class*='download']",
      "input[type='submit']",
      "#direct_link",
      ".download-link"
    ];

    for (const sel of buttonSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          console.log("[film2][puppeteer] Clicking:", sel);
          await el.click();
          // Wait up to 35 s for the countdown timer JS to fire and submit the form
          for (let s = 0; s < 35; s++) {
            if (resolvedUrl) break;
            await new Promise(r => setTimeout(r, 1000));
          }
          if (resolvedUrl) break;
        }
      } catch (_) {}
    }

    if (resolvedUrl) return resolvedUrl;

    // Check page HTML for video sources, JS variables, and data attributes
    const html = await page.content().catch(() => "");

    // Pattern 1: <video src="..."> or <source src="...">
    const videoSrcMatch = html.match(/<(?:video|source)[^>]+src=["']([^"']+\.(?:mp4|mkv|avi|mov|webm)[^"']*)["']/i);
    if (videoSrcMatch) {
      console.log("[film2][puppeteer] Found in <video>/<source> tag:", videoSrcMatch[1].substring(0, 100));
      return videoSrcMatch[1];
    }

    // Pattern 2: JS variable assignments like file:"...", src:"...", url:"..."
    const jsFileMatch = html.match(/(?:file|src|url|download_url|direct_link)\s*[:=]\s*["']([^"']+\.(?:mp4|mkv|avi|mov|webm)[^"']*)["']/i);
    if (jsFileMatch) {
      console.log("[film2][puppeteer] Found in JS variable:", jsFileMatch[1].substring(0, 100));
      return jsFileMatch[1];
    }

    // Pattern 3: data-url or data-src attributes
    const dataAttrMatch = html.match(/data-(?:url|src|file)=["']([^"']+\.(?:mp4|mkv|avi|mov|webm)[^"']*)["']/i);
    if (dataAttrMatch) {
      console.log("[film2][puppeteer] Found in data attribute:", dataAttrMatch[1].substring(0, 100));
      return dataAttrMatch[1];
    }

    // Pattern 4: Any bare https URL ending in video extension
    const matches = html.match(/https?:\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]+\.(?:mp4|mkv|avi|mov|webm)(?:\?[^"'\s<>]*)*/gi) || [];
    // Filter out known ad domains
    const filtered = matches.filter(u => !BLOCKED_CDN_DOMAINS.some(d => u.includes(d)));
    if (filtered.length) {
      console.log("[film2][puppeteer] Found bare URL in HTML:", filtered[0].substring(0, 100));
      return filtered[0];
    }

    return null; // could not resolve
  } catch (e) {
    console.error("[film2][puppeteer] Error:", e.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── ouo.io bypass (no puppeteer needed) ──────────────────────────────────────
async function resolveOuoIo(url, depth = 0) {
  if (depth > 3) return null;
  try {
    const res = await axios.post(url, "go=1", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": url,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      maxRedirects: 0,
      timeout: 20000,
      validateStatus: () => true
    });
    const location = res.headers?.location || res.headers?.Location;
    if (location && location !== url) {
      // If it lands on another ouo.io-like page, recurse
      if (location.includes("ouo.io")) return resolveOuoIo(location, depth + 1);
      return location;
    }
    // Check HTML for redirect or hidden link
    if (res.data) {
      const $ = cheerio.load(res.data);
      const metaRefresh = $("meta[http-equiv='refresh']").attr("content") || "";
      const metaUrl = metaRefresh.match(/url=(.+)/i)?.[1]?.trim();
      if (metaUrl && metaUrl !== url) return metaUrl;
      const anchor = $("a#go-link, a.btn-download, a[href*='download']").attr("href");
      if (anchor && anchor.startsWith("http")) return anchor;
    }
  } catch (e) {
    if (e.response?.headers?.location) return e.response.headers.location;
  }
  return null;
}

// ─── Try to resolve a direct download URL from various hosts ──────────────────
async function resolveDirectUrl(url, depth = 0) {
  if (!url || depth > 5) return null;

  // Pixeldrain
  const pdMatch = url.match(/pixeldrain\.com\/u\/(\w+)/);
  if (pdMatch) return `https://pixeldrain.com/api/file/${pdMatch[1]}?download`;

  // Google Drive
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) return `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;

  // Mediafire: fetch the page and extract direct link
  if (url.includes("mediafire.com")) {
    try {
      const res = await axios.get(url, {
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
        validateStatus: () => true
      });
      const $ = cheerio.load(res.data);
      const direct = $("a#downloadButton, a.download_link, a[aria-label='Download file']").attr("href")
        || $("a[href*='download.mediafire.com']").first().attr("href");
      if (direct) return direct;
    } catch (_) {}
    return null;
  }

  // ouo.io — bypass the interstitial with a POST
  if (url.includes("ouo.io") || url.includes("ouo.press")) {
    console.log("[film2] Bypassing ouo.io:", url.substring(0, 80));
    const resolved = await resolveOuoIo(url);
    if (resolved && resolved !== url) return resolveDirectUrl(resolved, depth + 1);
    return null;
  }

  // Simple URL shorteners — follow HTTP redirects
  const simpleRedirectors = ["tinyurl.com", "bit.ly", "shorturl", "linkshortify", "t.ly", "rb.gy"];
  if (simpleRedirectors.some(h => url.includes(h))) {
    try {
      const res = await axios.get(url, {
        maxRedirects: 10, timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
        validateStatus: () => true
      });
      const finalUrl = res.request?.res?.responseUrl || res.config?.url || url;
      if (finalUrl && finalUrl !== url) return resolveDirectUrl(finalUrl, depth + 1);
    } catch (_) {}
    return null;
  }

  // URL looks like a direct CDN/file link — return it as-is
  const looksLikeDirect = /\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(url)
    || url.includes("/download/")
    || url.includes("/dl/");
  if (looksLikeDirect) return url;

  // Hosts that require JS execution — use Puppeteer as next resort
  const puppeteerHosts = ["usersdrive", "dgdrive", "filepv", "bysezoxexe", "send.now", "1fichier"];
  if (puppeteerHosts.some(h => url.includes(h))) {
    console.log("[film2] Resolving with Puppeteer:", url.substring(0, 80));
    const resolved = await resolveWithPuppeteer(url);
    if (!resolved) {
      // Puppeteer failed — try the URL directly as a last resort
      console.log("[film2] Puppeteer returned nothing — attempting direct GET as fallback");
      return url;
    }
    // If Puppeteer landed on another intermediate host, recurse
    if (puppeteerHosts.some(h => resolved.includes(h)) || resolved.includes("ouo.io")) {
      return resolveDirectUrl(resolved, depth + 1);
    }
    return resolved;
  }

  // Unknown host — try following redirects and check if final URL is a direct file
  try {
    const res = await axios.head(url, {
      maxRedirects: 10, timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
      validateStatus: () => true
    });
    const finalUrl = res.request?.res?.responseUrl || url;
    const ct = (res.headers["content-type"] || "").toLowerCase();
    const cl = parseInt(res.headers["content-length"] || "0", 10);
    if (
      ct.includes("video/") ||
      ct.includes("application/octet-stream") ||
      ct.includes("application/force-download") ||
      (res.headers["content-disposition"] || "").includes("attachment") ||
      cl > 10 * 1024 * 1024
    ) {
      return finalUrl;
    }
    if (finalUrl !== url) return resolveDirectUrl(finalUrl, depth + 1);
  } catch (_) {}

  return null;
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────
async function searchMovies2(query) {
  const { data } = await proxyFetch2(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(data);
  const results = [];

  $("article.elementor-post").slice(0, 8).each((i, el) => {
    const thumbLink = $(el).find("a.elementor-post__thumbnail__link");
    const movieUrl = thumbLink.attr("href");
    const titleEl = $(el).find(".elementor-post__title a, h3 a, h2 a, h4 a").first();
    const title = titleEl.text().trim()
      || thumbLink.attr("title")
      || $(el).find("a[title]").attr("title")
      || "";
    const thumbnail = $(el).find(".elementor-post__thumbnail img").attr("src") || "";

    if (movieUrl && title) {
      results.push({ id: i + 1, title, movieUrl, thumbnail });
    }
  });

  return results;
}

async function getMovieDetails2(movieUrl) {
  const { data } = await proxyFetch2(movieUrl);
  const $ = cheerio.load(data);

  const title = $("h1.elementor-heading-title").first().text().trim()
    || $("h1").first().text().trim()
    || $("title").text().replace(/[–\-].*$/, "").trim();

  const thumbnail =
    $(".elementor-widget-theme-post-featured-image img").first().attr("src")
    || $(".wp-post-image").attr("src")
    || $("meta[property='og:image']").attr("content")
    || $("article img").first().attr("src")
    || "";

  const downloadOptions = [];

  // The page structure is: <p>quality label</p> followed by <p><a links></a></p>
  // We process all block elements sequentially, tracking the last seen quality.
  // Priority: use the most specific post-content container, NOT the generic
  // .elementor-widget-container (which appears 20+ times on each page).
  let contentEl = $(".elementor-widget-theme-post-content");
  if (!contentEl.length) contentEl = $(".entry-content");
  if (!contentEl.length) contentEl = $(".post-content");
  const elements = contentEl.length
    ? contentEl.find("p, h2, h3, h4").toArray()
    : $("article p, article h2, article h3").toArray();

  let currentQuality = null;
  let currentSize = null;
  let inDirectSection = false;

  for (const el of elements) {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ").trim();

    // Detect section headers — only collect links from "Direct Download" section
    if (/Direct\s*Download/i.test(text)) {
      inDirectSection = true;
      continue;
    }
    if (/Torrent/i.test(text) && !inDirectSection) {
      continue;
    }

    // Detect quality label lines: contain a quality keyword and pipe characters
    const qualityMatch = text.match(/(?:4K|2160p|1080p|720p|480p)/i);
    const sizeMatch = text.match(/([\d.]+)\s*(GB|MB)/i);
    const hasPipes = (text.match(/\|/g) || []).length >= 1;
    const isQualityLabel = qualityMatch && hasPipes && text.length < 200 && $el.find("a[href]").length === 0;

    if (isQualityLabel) {
      const baseQuality = qualityMatch[0].toUpperCase() === "4K" ? "4K" : qualityMatch[0];
      // Extract codec and extra tags for a more descriptive label
      const codecMatch = text.match(/x265|x264|HEVC|AVC|H\.265|H\.264/i);
      const is10bit = /10\s*bit/i.test(text);
      const codec = codecMatch ? codecMatch[0].toLowerCase() : "";
      let qualityLabel = baseQuality;
      if (codec) qualityLabel += ` ${codec}`;
      if (is10bit) qualityLabel += " 10bit";
      currentQuality = qualityLabel;
      currentSize = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : "N/A";
      continue;
    }

    // Collect external links from this element (image-anchors included)
    const links = [];
    $el.find("a[href]").each((j, a) => {
      const href = $(a).attr("href") || "";
      if (isExternalDownloadLink(href)) links.push(href);
    });

    if (links.length > 0 && currentQuality) {
      const existing = downloadOptions.find(
        d => d.quality === currentQuality && d.size === currentSize
      );
      if (existing) {
        for (const link of links) {
          if (!existing.links.includes(link)) existing.links.push(link);
        }
      } else {
        downloadOptions.push({ quality: currentQuality, size: currentSize, links });
      }
    }
  }

  // If nothing found with the sectioned approach, fall back to a global scan
  if (!downloadOptions.length) {
    let fallbackQuality = null;
    let fallbackSize = null;

    $("p, h2, h3").each((i, el) => {
      const $el = $(el);
      const text = $el.text().replace(/\s+/g, " ").trim();
      const qm = text.match(/(?:4K|2160p|1080p|720p|480p)/i);
      const sm = text.match(/([\d.]+)\s*(GB|MB)/i);

      if (qm && (text.includes("|") || sm) && text.length < 200 && $el.find("a[href]").length === 0) {
        const bq = qm[0].toUpperCase() === "4K" ? "4K" : qm[0];
        const cm = text.match(/x265|x264|HEVC|AVC|H\.265|H\.264/i);
        const c = cm ? cm[0].toLowerCase() : "";
        const b10 = /10\s*bit/i.test(text);
        fallbackQuality = bq + (c ? ` ${c}` : "") + (b10 ? " 10bit" : "");
        fallbackSize = sm ? `${sm[1]} ${sm[2].toUpperCase()}` : "N/A";
      }

      const links = [];
      $el.find("a[href]").each((j, a) => {
        const href = $(a).attr("href") || "";
        if (isExternalDownloadLink(href)) links.push(href);
      });

      // Also check next sibling for links (common pattern)
      const nextLinks = [];
      const $next = $el.next();
      $next.find("a[href]").each((j, a) => {
        const href = $(a).attr("href") || "";
        if (isExternalDownloadLink(href)) nextLinks.push(href);
      });

      const allLinks = [...new Set([...links, ...nextLinks])];
      if (allLinks.length > 0 && fallbackQuality) {
        const existing = downloadOptions.find(
          d => d.quality === fallbackQuality && d.size === fallbackSize
        );
        if (existing) {
          for (const link of allLinks) {
            if (!existing.links.includes(link)) existing.links.push(link);
          }
        } else {
          downloadOptions.push({ quality: fallbackQuality, size: fallbackSize, links: allLinks });
        }
      }
    });
  }

  function baseQualityRank(q) {
    const m = q.match(/4K|2160p|1080p|720p|480p/i);
    return m ? (QUALITY_ORDER[m[0]] || 0) : 0;
  }
  downloadOptions.sort((a, b) => baseQualityRank(b.quality) - baseQualityRank(a.quality));

  return { title, thumbnail, downloadOptions };
}

// ─── Link Priority (higher = try first) ───────────────────────────────────────
function getLinkPriority(url) {
  if (!url) return 0;
  if (url.includes("pixeldrain.com")) return 10;
  if (url.includes("mediafire.com")) return 9;
  if (url.includes("drive.google.com")) return 8;
  if (/\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(url)) return 8;
  if (url.includes("tinyurl.com") || url.includes("bit.ly") || url.includes("rb.gy") || url.includes("t.ly")) return 6;
  if (url.includes("ouo.io") || url.includes("ouo.press")) return 5;
  if (url.includes("1fichier.com")) return 4;
  if (url.includes("mega.nz")) return 3;
  // JS-heavy hosts — try last
  return 2;
}

// ─── Download Engine ──────────────────────────────────────────────────────────
async function executeMovieDownload2(task) {
  const { sock, from, mek, sender, selectedOption, movie } = task;
  const movieTitle = movie.title || "Movie";
  const tempPath = path.join("/tmp", `bs_movie_${Date.now()}.mp4`);

  const displaySize = (selectedOption.size && selectedOption.size !== "N/A") ? selectedOption.size : "Unknown";
  const progress = await sendLiveProgress2(sock, from, mek, {
    title: movieTitle,
    quality: selectedOption.quality,
    size: displaySize,
    downloadPercent: 0,
    uploadPercent: 0,
    stage: "Auto-selecting best server...",
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSecond: 0
  });

  let uploadTimer = null;
  global.activeMovieDownloads2.add(sender);

  try {
    // Sort links by reliability so the best server is tried first (mirrors film.js logic)
    const sortedLinks = [...selectedOption.links].sort((a, b) => getLinkPriority(b) - getLinkPriority(a));

    let downloadedBytes, totalBytes;
    let downloadSucceeded = false;
    const triedLinks = [];

    for (const rawLink of sortedLinks) {
      const label = getHostLabel(rawLink);
      triedLinks.push(rawLink);

      let directUrl = null;
      try {
        progress.update({ stage: `🌐 Resolving ${label}...` });
        directUrl = await resolveDirectUrl(rawLink);
      } catch (resolveErr) {
        console.warn(`[film2] Resolve error for ${label}:`, resolveErr.message);
      }

      if (!directUrl) {
        console.warn(`[film2] Could not resolve ${label} — trying next link`);
        continue;
      }

      try {
        progress.update({ stage: `⬇️ Downloading via ${label}...` });
        const result = await downloadMovieToFile2(directUrl, tempPath, update => {
          progress.update({ ...update, stage: `⬇️ Downloading via ${label}...` });
        });
        downloadedBytes = result.downloadedBytes;
        totalBytes = result.totalBytes;
        downloadSucceeded = true;
        break; // success — stop trying other links
      } catch (dlErr) {
        const isRetryable = dlErr.message === "REQUIRES_PAGE"
          || dlErr.message.startsWith("HTTP_")
          || dlErr.message.includes("404")
          || dlErr.message.includes("410")
          || dlErr.message.includes("HTML");
        console.warn(`[film2] Download failed via ${label} (${dlErr.message}) — ${isRetryable ? "trying next link" : "fatal"}`);
        if (fs.existsSync(tempPath)) { try { fs.unlinkSync(tempPath); } catch (_) {} }
        if (!isRetryable) throw dlErr;
        // Otherwise continue to next link
      }
    }

    if (!downloadSucceeded) {
      // All links failed — send them as text so user can download manually
      await progress.stop({ stage: "Sending links instead..." });
      const linkLines = selectedOption.links.map(url =>
        `${getHostLabel(url)}\n${url}`
      ).join("\n\n");
      const fbSizeInfo = (selectedOption.size && selectedOption.size !== "N/A") ? `  •  ${selectedOption.size}` : "";
      const fallbackMsg =
        `╭─────────────────────────╮\n` +
        `│  🔗 *Download Links*\n` +
        `│\n` +
        `│  🎬 ${movieTitle}\n` +
        `│  📊 ${selectedOption.quality}${fbSizeInfo}\n` +
        `│\n` +
        `│  *${selectedOption.links.length} server(s) available*\n` +
        `│  _Auto-download not supported for_\n` +
        `│  _these hosts — tap a link below_\n` +
        `╰─────────────────────────╯\n\n` +
        linkLines + "\n\n" +
        `_Tap any link above to open the download page._\n` +
        `_If one server is slow, try another one._`;
      await sock.sendMessage(from, { text: fallbackMsg }, { quoted: mek });
      await sock.sendMessage(from, { react: { text: "🔗", key: mek.key } });
      return;
    }

    const savedSize = fs.statSync(tempPath).size;
    progress.update({ downloadPercent: 100, uploadPercent: 0, downloadedBytes, totalBytes, stage: "Done! Sending to chat..." });

    const sizeInfo = (selectedOption.size && selectedOption.size !== "N/A") ? `  •  ${selectedOption.size}` : "";
    const caption =
      `╭─────────────────────────╮\n` +
      `│  ✅ *Movie Ready!*\n` +
      `│\n` +
      `│  🎬 ${movieTitle}\n` +
      `│  📊 ${selectedOption.quality}${sizeInfo}\n` +
      `│  🌐 Source: Baiscopedownloads.link\n` +
      `│\n` +
      `│  🍿 Enjoy watching!\n` +
      `╰─────────────────────────╯`;

    const fileName = `${movieTitle.substring(0, 50)} - ${selectedOption.quality}.mp4`
      .replace(/[^\w\s.-]/gi, "");

    if (savedSize > MOVIE_UPLOAD_MAX_BYTES2) {
      const partCount = Math.min(3, Math.ceil(savedSize / MOVIE_UPLOAD_MAX_BYTES2));
      progress.update({ downloadPercent: 100, uploadPercent: 0, stage: `Splitting into ${partCount} parts...` });

      let splitPercent = 0;
      const splitTimer = setInterval(() => {
        splitPercent = Math.min(30, splitPercent + 1);
        progress.update({ uploadPercent: splitPercent, stage: `Splitting into ${partCount} parts...` });
      }, 600);

      let partPaths = [];
      let usedFfmpeg = false;
      try {
        partPaths = await splitVideoWithFfmpeg2(tempPath, partCount, movieTitle);
        usedFfmpeg = true;
      } catch (ffmpegErr) {
        console.error("[film2] ffmpeg split failed, falling back to byte-split:", ffmpegErr.message);
      }
      clearInterval(splitTimer);

      if (usedFfmpeg && partPaths.length) {
        await sock.sendMessage(from, {
          text:
            `╭─────────────────────────╮\n` +
            `│  🎬 *${movieTitle}*\n` +
            `│  📦 Sending in *${partCount} parts*\n` +
            `│  📥 Tap each part to download\n` +
            `│  ▶️  Opens in your video player\n` +
            `╰─────────────────────────╯`
        }, { quoted: mek });

        for (let i = 0; i < partPaths.length; i++) {
          const partNum = i + 1;
          let uploadPercent = 0;
          uploadTimer = setInterval(() => {
            uploadPercent = Math.min(95, uploadPercent + 3);
            progress.update({ uploadPercent, stage: `Uploading part ${partNum}/${partCount}...` });
          }, 1000);

          await sock.sendMessage(from, {
            document: { url: partPaths[i] },
            mimetype: "video/mp4",
            fileName: `${movieTitle} - Part ${partNum} of ${partCount}.mp4`,
            caption: `${caption}\n\n📥 *Part ${partNum} of ${partCount}* — tap to download, then play`
          }, { quoted: mek });

          clearInterval(uploadTimer);
          uploadTimer = null;
          if (fs.existsSync(partPaths[i])) fs.unlinkSync(partPaths[i]);
        }
        await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: `All ${partCount} parts sent! 🍿` });
      } else {
        await sendSplitMovieParts2(sock, from, mek, tempPath, fileName.replace(".mp4", ""), caption, savedSize, progress);
        await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: "All parts sent! 🍿" });
      }

    } else {
      let uploadPercent = 0;
      uploadTimer = setInterval(() => {
        uploadPercent = Math.min(95, uploadPercent + 2);
        progress.update({ uploadPercent, stage: "Uploading film to chat..." });
      }, 1000);

      await sock.sendMessage(from, {
        video: { url: tempPath },
        mimetype: "video/mp4",
        fileName,
        caption
      }, { quoted: mek });

      clearInterval(uploadTimer);
      uploadTimer = null;
      await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: "Sent! 🍿" });
    }

  } catch (error) {
    console.error("[film2] Movie Download Error:", error.message, error.stack);
    if (uploadTimer) clearInterval(uploadTimer);
    await progress.stop({ stage: "Failed ❌" });
    await sock.sendMessage(from, {
      text: `❌ *Failed to send movie.*\nError: ${error.message}\nPlease try again or choose a different quality.`
    }, { quoted: mek });
  } finally {
    global.activeMovieDownloads2.delete(sender);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    processMovieQueue2();
  }
}

function processMovieQueue2() {
  while (
    global.movieDownloadQueue2.length > 0 &&
    global.activeMovieDownloads2.size < MAX_MOVIE_DOWNLOADS2
  ) {
    const next = global.movieDownloadQueue2.shift();

    global.movieDownloadQueue2.forEach((item, i) => {
      const pos = i + 1;
      item.sock.sendMessage(item.from, {
        text:
          `╭─────────────────────────╮\n` +
          `│  🎬 *Queue Update*\n` +
          `│\n` +
          `│  📋 You are now *#${pos}* in queue\n` +
          `│  🎬 ${item.movie.title}\n` +
          `│  ⏳ Almost there...\n` +
          `╰─────────────────────────╯`
      }, { quoted: item.mek }).catch(() => {});
    });

    const nextSizeLabel = (next.selectedOption.size && next.selectedOption.size !== "N/A") ? `  •  ${next.selectedOption.size}` : "";
    next.sock.sendMessage(next.from, {
      text:
        `╭─────────────────────────╮\n` +
        `│  ✅ *Your Turn!*\n` +
        `│\n` +
        `│  🎬 ${next.movie.title}\n` +
        `│  📊 ${next.selectedOption.quality}${nextSizeLabel}\n` +
        `│\n` +
        `│  ⬇️ Starting your download now...\n` +
        `╰─────────────────────────╯`
    }, { quoted: next.mek }).catch(() => {});

    executeMovieDownload2(next);
  }
}

// ─── Step 1: Search ───────────────────────────────────────────────────────────
cmd({
  pattern: "baiscope",
  alias: ["bs", "film2", "baiscopelk"],
  react: "🎬",
  desc: "Search and Download movies from Baiscopedownloads.link",
  category: "download",
  filename: __filename
}, async (ranuxPro, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply(
    `🎬 *Baiscope Movie Search*\n\n` +
    `Usage: \`.baiscope <title>\`\n` +
    `Example: \`.baiscope avatar\`\n\n` +
    `_Also works with:_ .film2 | .bs`
  );

  if (global.pendingMovie2[sender]) delete global.pendingMovie2[sender];

  await reply(`🔍 Searching for *"${q}"*...`);

  try {
    const results = await searchMovies2(q);
    if (!results.length) return reply(
      `❌ *No results for "${q}"*\n\n` +
      `Try a shorter or different title.\n` +
      `_Example:_ .baiscope avatar`
    );

    global.pendingMovie2[sender] = { step: 1, results, timestamp: Date.now() };

    const text =
      `╭─────────────────────────╮\n` +
      `│  🎬 *Baiscope Search*\n` +
      `│\n` +
      `│  🔍 "${q}"\n` +
      `│  Found *${results.length}* result(s)\n` +
      `│\n` +
      `│  👇 Tap a title to select\n` +
      `╰─────────────────────────╯`;

    const buttons = results.map((r, i) => btn(`bs_select_${i + 1}`, `🎬 ${r.title}`));

    await sendBtn(ranuxPro, from, {
      image: { url: LOGO_URL },
      title: "🎬 Baiscope Search Results",
      text,
      buttons,
    }, { quoted: mek });

  } catch (e) {
    console.error("Baiscope Search Error:", e.message);
    reply(`❌ Search failed. Please try again.\n_${e.message || ""}_`);
  }
});

// ─── Cancel session ───────────────────────────────────────────────────────────
cmd({
  pattern: "cancelbs",
  alias: ["stopbs"],
  react: "🚫",
  desc: "Cancel your current Baiscope movie session",
  category: "download",
  filename: __filename
}, async (ranuxPro, mek, m, { from, sender, reply }) => {
  if (global.pendingMovie2[sender]) {
    delete global.pendingMovie2[sender];
    reply("✅ *Cancelled.* Start a new search with `.baiscope <title>`");
  } else {
    reply("ℹ️ No active Baiscope session to cancel.");
  }
});

// ─── Step 2: Movie Details ────────────────────────────────────────────────────
cmd({
  filter: (body, { sender }) =>
    global.pendingMovie2[sender] &&
    global.pendingMovie2[sender].step === 1 &&
    /^bs_select_\d+$/.test(body)
}, async (ranuxPro, mek, m, { body, sender, reply, from }) => {

  await ranuxPro.sendMessage(from, { react: { text: "⏳", key: mek.key } });

  const index = parseInt(body.replace("bs_select_", "")) - 1;
  const { results } = global.pendingMovie2[sender];

  if (index < 0 || index >= results.length) {
    return reply("❌ *Invalid selection.* Please search again.");
  }

  const selected = results[index];
  delete global.pendingMovie2[sender];

  try {
    await reply(`⏳ Loading *"${selected.title}"*...`);
    const details = await getMovieDetails2(selected.movieUrl);

    const title = details.title || selected.title;
    const thumbnail = details.thumbnail || selected.thumbnail;

    if (!details.downloadOptions.length) {
      return reply(
        `❌ *No download links found for this movie.*\n\n` +
        `The page may not have download links yet.\n` +
        `Try a different movie or check back later.`
      );
    }

    global.pendingMovie2[sender] = {
      step: 2,
      movie: { title, thumbnail, downloadOptions: details.downloadOptions },
      timestamp: Date.now()
    };

    const infoMsg =
      `╭─────────────────────────╮\n` +
      `│  🎬 *${title}*\n` +
      `│\n` +
      `│  📥 ${details.downloadOptions.length} quality option(s)\n` +
      `│  Source: Baiscopedownloads.link\n` +
      `│\n` +
      `│  👇 Tap a quality to download\n` +
      `╰─────────────────────────╯`;

    const qualityButtons = details.downloadOptions.map((d, i) => {
      const sizeLabel = (d.size && d.size !== "N/A") ? `  •  ${d.size}` : "";
      return btn(`bs_dl_${i + 1}`, `📥 ${d.quality}${sizeLabel}`);
    });

    if (thumbnail) {
      await ranuxPro.sendMessage(from, {
        image: { url: thumbnail },
        caption: infoMsg
      }, { quoted: mek });
    } else {
      await ranuxPro.sendMessage(from, { text: infoMsg }, { quoted: mek });
    }

    await sendBtn(ranuxPro, from, {
      text:
        `╭─────────────────────────╮\n` +
        `│  📥 *Choose Quality*\n` +
        `│  ${details.downloadOptions.length} option(s) — best first\n` +
        `│  👇 Tap to start download\n` +
        `╰─────────────────────────╯`,
      buttons: qualityButtons,
    }, { quoted: mek });

  } catch (e) {
    delete global.pendingMovie2[sender];
    console.error("Baiscope Detail Error:", e.message);
    reply(`❌ Couldn't load this movie. Please try again.\n_${e.message || ""}_`);
  }
});

// ─── Step 3: Download Movie to Chat ──────────────────────────────────────────
cmd({
  filter: (body, { sender }) =>
    global.pendingMovie2[sender] &&
    global.pendingMovie2[sender].step === 2 &&
    /^bs_dl_\d+$/.test(body)
}, async (ranuxPro, mek, m, { body, sender, reply, from }) => {

  await ranuxPro.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

  const index = parseInt(body.replace("bs_dl_", "")) - 1;
  const { movie } = global.pendingMovie2[sender];

  if (index < 0 || index >= movie.downloadOptions.length) {
    return reply("❌ *Invalid selection.* Please search again.");
  }

  const selectedOption = movie.downloadOptions[index];
  delete global.pendingMovie2[sender];

  const task = { sock: ranuxPro, from, mek, sender, selectedOption, movie };

  if (global.activeMovieDownloads2.size < MAX_MOVIE_DOWNLOADS2) {
    executeMovieDownload2(task);
    return;
  }

  global.movieDownloadQueue2.push(task);
  const queuePos = global.movieDownloadQueue2.length;
  const activeCount = global.activeMovieDownloads2.size;

  const queueSizeLabel = (selectedOption.size && selectedOption.size !== "N/A") ? `  •  ${selectedOption.size}` : "";
  await reply(
    `╭─────────────────────────╮\n` +
    `│  📋 *Added to Queue*\n` +
    `│\n` +
    `│  🎬 ${movie.title}\n` +
    `│  📊 ${selectedOption.quality}${queueSizeLabel}\n` +
    `│\n` +
    `│  🔢 Queue position: *#${queuePos}*\n` +
    `│  ⚙️ Active downloads: ${activeCount}/${MAX_MOVIE_DOWNLOADS2}\n` +
    `│\n` +
    `│  ⏳ You'll be notified when it's your turn.\n` +
    `╰─────────────────────────╯`
  );
});

// ─── Auto-cleanup stale sessions ──────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000;
  for (const sender in global.pendingMovie2) {
    if (now - (global.pendingMovie2[sender].timestamp || 0) > timeout) {
      delete global.pendingMovie2[sender];
    }
  }
}, 5 * 60 * 1000);

// Periodically clean expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of proxyCache2.entries()) {
    if (now >= val.expiry) proxyCache2.delete(key);
  }
}, 10 * 60 * 1000);
