const { cmd } = require("../../command");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { pipeline } = require("stream/promises");
const { sendBtn, btn } = require("../../utils/sendBtn");

// Patch Baileys upload timeout from 30s → 30 minutes so large files can upload
try {
  const baileys = require("@whiskeysockets/baileys");
  if (baileys.UPLOAD_TIMEOUT !== undefined) baileys.UPLOAD_TIMEOUT = 30 * 60 * 1000;
} catch (_) {}

// Global State
global.pendingMovie = global.pendingMovie || {};
global.activeMovieDownloads = global.activeMovieDownloads || new Set();

// Design Elements
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";
const BASE_URL = "https://sinhalasub.lk";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";
const DOWNLOAD_HIGH_WATER_MARK = 2 * 1024 * 1024;
const MAX_MOVIE_DOWNLOADS = Math.max(1, Number(process.env.MAX_MOVIE_DOWNLOADS) || 1);
const MOVIE_UPLOAD_MAX_MB = Math.max(50, Number(process.env.MOVIE_UPLOAD_MAX_MB) || 300);
const MOVIE_UPLOAD_MAX_BYTES = MOVIE_UPLOAD_MAX_MB * 1024 * 1024;
const MOVIE_SPLIT_MAX_MB = Math.max(MOVIE_UPLOAD_MAX_MB, Number(process.env.MOVIE_SPLIT_MAX_MB) || MOVIE_UPLOAD_MAX_MB * 3);
const MOVIE_SPLIT_MAX_BYTES = MOVIE_SPLIT_MAX_MB * 1024 * 1024;
const downloadHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 8 });
const downloadHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8 });

// Quality order for sorting (higher = better)
const QUALITY_ORDER = { "1080p": 3, "720p": 2, "480p": 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function proxyFetch(url, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(PROXY + encodeURIComponent(url), {
        timeout: 25000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastError;
}

function normalizeQuality(text) {
  if (!text) return "Unknown";
  text = text.toUpperCase();
  if (/1080|FHD/.test(text)) return "1080p";
  if (/720|HD/.test(text)) return "720p";
  if (/480|SD/.test(text)) return "480p";
  return text;
}

function getDirectPixeldrainUrl(url) {
  const match = url.match(/pixeldrain\.com\/u\/(\w+)/);
  if (!match) return null;
  return `https://pixeldrain.com/api/file/${match[1]}?download`;
}

function formatBytes(bytes) {
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

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

function parseSizeToBytes(sizeText) {
  if (!sizeText) return 0;
  const match = String(sizeText).replace(",", ".").match(/([\d.]+)\s*(GB|GIB|MB|MIB|KB|KIB|B)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toUpperCase();
  if (unit === "GB" || unit === "GIB") return value * 1024 * 1024 * 1024;
  if (unit === "MB" || unit === "MIB") return value * 1024 * 1024;
  if (unit === "KB" || unit === "KIB") return value * 1024;
  return value;
}

function renderProgressBar(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const width = 20;
  const filled = Math.round((safePercent / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${safePercent}%`;
}

function renderMovieProgress({ title, quality, size, percent, downloadPercent, uploadPercent, stage, downloadedBytes, totalBytes, speedBytesPerSecond, startedAt }) {
  const downloaded = formatBytes(downloadedBytes);
  const total = formatBytes(totalBytes);
  const sizeLine = downloaded && total ? `│ 📦 *Progress:* ${downloaded} / ${total}\n` : "";
  const speed = formatBytes(speedBytesPerSecond);
  const speedLine = speed ? `│ 🚀 *Speed:* ${speed}/s\n` : "";
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  // ETA calculation
  let etaLine = "";
  const safeDownloadPercent = downloadPercent ?? percent ?? 0;
  if (speedBytesPerSecond > 0 && totalBytes > 0 && downloadedBytes > 0 && safeDownloadPercent < 100) {
    const remainingBytes = totalBytes - downloadedBytes;
    const etaSeconds = remainingBytes / speedBytesPerSecond;
    const etaStr = formatEta(etaSeconds);
    if (etaStr) etaLine = `│ ⏳ *ETA:* ${etaStr}\n`;
  }

  const safeUploadPercent = uploadPercent ?? 0;
  return (
    `╭───〔 📥 *𝐌𝐎𝐕𝐈𝐄 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃* 〕───┈\n` +
    `│\n` +
    `│ 🎬 *Movie:* ${title}\n` +
    `│ 📊 *Quality:* ${quality}\n` +
    `│ 💾 *Size:* ${size}\n` +
    sizeLine +
    speedLine +
    etaLine +
    `│ ⏱️ *Time:* ${elapsedSeconds}s\n` +
    `│ ⚙️ *Status:* ${stage}\n` +
    `│ ⬇️ *Download:* ${renderProgressBar(safeDownloadPercent)}\n` +
    `│ ⬆️ *Upload:*   ${renderProgressBar(safeUploadPercent)}\n` +
    `│\n` +
    `╰──────────────────────┈\n` +
    `_This message updates every second until the film appears in chat._`
  );
}

function buildDirectLinkMessage({ title, quality, size, link, directUrl, reason }) {
  return (
    `╭───〔 🔗 *𝐃𝐈𝐑𝐄𝐂𝐓 𝐌𝐎𝐕𝐈𝐄 𝐋𝐈𝐍𝐊* 〕───┈\n` +
    `│\n` +
    `│ 🎬 *Movie:* ${title}\n` +
    `│ 📊 *Quality:* ${quality}\n` +
    `│ 💾 *Size:* ${size}\n` +
    `│ 🛡️ *Reason:* ${reason}\n` +
    `│\n` +
    `╰──────────────────────┈\n\n` +
    `This file is too large to send directly through the bot. Use the link below to download it:\n\n` +
    `🌐 *Page:* ${link}\n\n` +
    `⬇️ *Direct download:*\n${directUrl}`
  );
}

async function downloadMovieToFile(url, tempPath, onProgress) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: 0,
    maxRedirects: 5,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    decompress: false,
    httpAgent: downloadHttpAgent,
    httpsAgent: downloadHttpsAgent,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Connection": "keep-alive"
    },
    validateStatus: status => status >= 200 && status < 300
  });

  const totalBytes = Number(response.headers["content-length"]) || 0;
  const startedAt = Date.now();
  let downloadedBytes = 0;
  let lastProgressAt = 0;

  response.data.on("data", chunk => {
    downloadedBytes += chunk.length;
    const now = Date.now();
    if (now - lastProgressAt < 250 && downloadedBytes !== totalBytes) return;
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
  });

  await pipeline(
    response.data,
    fs.createWriteStream(tempPath, { highWaterMark: DOWNLOAD_HIGH_WATER_MARK })
  );

  if (totalBytes && downloadedBytes !== totalBytes) {
    throw new Error(`Incomplete download (${formatBytes(downloadedBytes)} of ${formatBytes(totalBytes)})`);
  }

  return { downloadedBytes, totalBytes };
}

async function copyRangeToPart(sourcePath, partPath, start, end) {
  await pipeline(
    fs.createReadStream(sourcePath, { start, end, highWaterMark: DOWNLOAD_HIGH_WATER_MARK }),
    fs.createWriteStream(partPath, { highWaterMark: DOWNLOAD_HIGH_WATER_MARK })
  );
}

async function sendSplitMovieParts(sock, chatId, quoted, sourcePath, baseFileName, baseCaption, totalSize, progress, partSize) {
  const bytesPerPart = partSize || MOVIE_UPLOAD_MAX_BYTES;
  const partCount = Math.ceil(totalSize / bytesPerPart);
  const partSizeMB = Math.ceil(bytesPerPart / (1024 * 1024));
  const partPaths = [];
  let uploadTimer = null;

  try {
    await sock.sendMessage(chatId, {
      text:
        `*📦 Large movie detected — sending in ${partCount} part${partCount > 1 ? "s" : ""}.*\n\n` +
        `Each part is up to ${formatBytes(bytesPerPart)}. Download every part and join them in order to restore the full movie.\n\n` +
        `_Tip: Use_ *HJSplit* _(Windows) or run_ \`cat part01 part02 > movie.mp4\` _(Linux/Mac) to merge._`
    }, { quoted });

    for (let index = 0; index < partCount; index += 1) {
      const partNumber = index + 1;
      const start = index * bytesPerPart;
      const end = Math.min(totalSize - 1, start + bytesPerPart - 1);
      const partPath = `${sourcePath}.part${String(partNumber).padStart(2, "0")}of${String(partCount).padStart(2, "0")}`;
      const partFileName = `${baseFileName}.part${String(partNumber).padStart(2, "0")}of${String(partCount).padStart(2, "0")}`;
      partPaths.push(partPath);

      progress.update({
        uploadPercent: Math.round((index / partCount) * 100),
        stage: `Preparing part ${partNumber}/${partCount}...`
      });

      await copyRangeToPart(sourcePath, partPath, start, end);

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
        mimetype: "video/mp4",
        fileName: partFileName,
        caption:
          `${baseCaption}\n\n` +
          `📦 *Part:* ${partNumber}/${partCount}\n` +
          `📏 *Part size:* ${formatBytes(end - start + 1)}\n\n` +
          `⚠️ _Each part is a fragment — download all ${partCount} parts and join them to watch the full movie._`
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
    for (const partPath of partPaths) {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    }
  }
}

async function sendLiveProgress(sock, chatId, quoted, initialState) {
  let state = { startedAt: Date.now(), ...initialState };
  let stopped = false;
  let editing = false;
  let lastText = "";
  const message = await sock.sendMessage(chatId, { text: renderMovieProgress(state) }, { quoted });

  const edit = async (force = false) => {
    if (stopped || !message?.key) return;
    if (editing) {
      if (!force) return;
      while (editing) await new Promise(resolve => setTimeout(resolve, 100));
      if (stopped) return;
    }
    editing = true;
    try {
      const text = renderMovieProgress(state);
      if (force || text !== lastText) {
        lastText = text;
        await sock.sendMessage(chatId, { text, edit: message.key });
      }
    } catch (e) {
      console.error("Movie progress edit error:", e.message);
    } finally {
      editing = false;
    }
  };

  lastText = renderMovieProgress(state);
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

// ─── Scrapers ─────────────────────────────────────────────────────────────────
async function searchMovies(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=movies`;
  let data;
  try {
    const res = await proxyFetch(url);
    data = res.data;
  } catch (err) {
    throw new Error(`Could not reach the movie site. Please try again. (${err.message})`);
  }
  const $ = cheerio.load(data);
  const results = [];
  $(".display-item .item-box").slice(0, 8).each((i, el) => {
    const a = $(el).find("a").first();
    const title = a.attr("title") || a.text().trim();
    const movieUrl = a.attr("href");
    if (title && movieUrl) results.push({ id: i + 1, title, movieUrl });
  });
  return results;
}

async function getMovieMetadata(movieUrl) {
  let data;
  try {
    const res = await proxyFetch(movieUrl);
    data = res.data;
  } catch (err) {
    throw new Error(`Failed to load movie page. (${err.message})`);
  }
  const $ = cheerio.load(data);
  const title = $(".info-details .details-title h3").text().trim();
  const imdb = $(".info-details .data-imdb").text().replace("IMDb:", "").trim() || "N/A";
  const duration = $(".info-details .data-views[itemprop='duration']").text().trim() || "N/A";
  const genres = $(".details-genre a").map((i, el) => $(el).text().trim()).get();
  const thumbnail = $(".splash-bg img").attr("src") || "";
  let directors = [];
  let language = "N/A";
  $(".info-col p").each((i, el) => {
    const strong = $(el).find("strong");
    const txt = strong.text().trim();
    if (txt.includes("Language:")) language = strong.next().text().trim() || "N/A";
    if (txt.includes("Director:")) directors = $(el).find("a").map((j, a) => $(a).text().trim()).get();
  });
  return { title, imdb, duration, genres, directors, language, thumbnail };
}

async function getPixeldrainLinks(movieUrl) {
  let data;
  try {
    const res = await proxyFetch(movieUrl);
    data = res.data;
  } catch (err) {
    throw new Error(`Failed to load download page. (${err.message})`);
  }
  const $ = cheerio.load(data);
  const rows = [];
  $(".link-pixeldrain tbody tr").each((i, row) => {
    const pageLink = $(row).find(".link-opt a").attr("href");
    const quality = $(row).find(".quality").text().trim();
    const size = $(row).find("td:nth-child(3) span").text().trim();
    if (pageLink) rows.push({ pageLink, quality, size });
  });

  const directLinks = [];
  for (const row of rows) {
    try {
      const { data: linkData } = await proxyFetch(row.pageLink, 2);
      const $l = cheerio.load(linkData);
      const pdUrl = $l('a[href*="pixeldrain.com"]').attr("href");
      if (pdUrl) {
        directLinks.push({
          link: pdUrl,
          quality: normalizeQuality(row.quality),
          size: row.size
        });
      }
    } catch (e) { continue; }
  }

  // Sort by quality: best quality first
  directLinks.sort((a, b) => (QUALITY_ORDER[b.quality] || 0) - (QUALITY_ORDER[a.quality] || 0));

  return directLinks;
}

// ─── Step 1: Search ───────────────────────────────────────────────────────────
cmd({
  pattern: "movie",
  alias: ["sinhalasub", "films", "mv", "film"],
  react: "🎬",
  desc: "Search and Download movies from Sinhalasub.lk",
  category: "download",
  filename: __filename
}, async (ranuxPro, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply(
    `*ℹ️ Please provide a movie name.*\n\n` +
    `*Example:* \`.movie avatar\`\n\n` +
    `*Aliases:* .film | .mv | .films | .sinhalasub`
  );

  if (global.pendingMenu) delete global.pendingMenu[sender];
  if (global.pendingVideo) delete global.pendingVideo[sender];
  if (global.pendingMovie[sender]) delete global.pendingMovie[sender];

  await reply(`*⏳ Searching for "${q}"...*`);

  try {
    const searchResults = await searchMovies(q);
    if (!searchResults.length) return reply(
      `*❌ No movies found for "*${q}*"*\n\n` +
      `Try a different spelling or a shorter title.\n` +
      `_Example: .movie avatar (not "Avatar: The Way of Water")_`
    );

    global.pendingMovie[sender] = { step: 1, results: searchResults, timestamp: Date.now() };

    const text =
      `╭───〔 🎬 *𝐌𝐎𝐕𝐈𝐄 𝐒𝐄𝐀𝐑𝐂𝐇* 〕───┈\n` +
      `│\n` +
      `│ 🔍 *Results for:* "${q}"\n` +
      `│ 🌸 *Found:* ${searchResults.length} movie(s)\n` +
      `│\n` +
      `╰──────────────────────┈\n\n` +
      `*👇 Tap a movie below to select it:*`;

    const movieButtons = searchResults.map((movie, i) =>
      btn(`mv_select_${i + 1}`, `🎬 ${movie.title}`)
    );

    await sendBtn(ranuxPro, from, {
      image: { url: LOGO_URL },
      title: "🎬 Movie Search Results",
      text,
      buttons: movieButtons,
    }, { quoted: mek });

  } catch (e) {
    console.error("Movie Search Error:", e.message);
    reply(`❌ *Search failed:* ${e.message || "Please try again later."}`);
  }
});

// ─── Cancel movie session ─────────────────────────────────────────────────────
cmd({
  pattern: "cancelmovie",
  alias: ["stopmovie", "mvcancel"],
  react: "🚫",
  desc: "Cancel your current movie selection session",
  category: "download",
  filename: __filename
}, async (ranuxPro, mek, m, { from, sender, reply }) => {
  if (global.pendingMovie[sender]) {
    delete global.pendingMovie[sender];
    reply("*✅ Movie session cancelled.* You can start a new search with `.movie <title>`.");
  } else {
    reply("*ℹ️ You have no active movie session to cancel.*");
  }
});

// ─── Step 2: Movie Details (button tap mv_select_N) ───────────────────────────
cmd({
  filter: (body, { sender }) =>
    global.pendingMovie[sender] &&
    global.pendingMovie[sender].step === 1 &&
    /^mv_select_\d+$/.test(body)
}, async (ranuxPro, mek, m, { body, sender, reply, from }) => {

  await ranuxPro.sendMessage(from, { react: { text: "⏳", key: mek.key } });

  const index = parseInt(body.replace("mv_select_", "")) - 1;
  const { results } = global.pendingMovie[sender];

  if (index < 0 || index >= results.length) {
    return reply("❌ *Invalid selection. Please search again.*");
  }

  const selected = results[index];
  delete global.pendingMovie[sender];

  try {
    await reply(`*⏳ Fetching details for "${selected.title}"...*`);
    const metadata = await getMovieMetadata(selected.movieUrl);

    const metaMsg =
      `╭───〔 🎬 *𝐌𝐎𝐕𝐈𝐄 𝐃𝐄𝐓𝐀𝐈𝐋𝐒* 〕───┈\n` +
      `│\n` +
      `│ 🏷️ *Title:* ${metadata.title || selected.title}\n` +
      `│ ⭐ *IMDb:* ${metadata.imdb}\n` +
      `│ 🕒 *Duration:* ${metadata.duration}\n` +
      `│ 🎭 *Genre:* ${metadata.genres.join(", ") || "N/A"}\n` +
      `│ 👤 *Director:* ${metadata.directors.join(", ") || "N/A"}\n` +
      `│ 🌐 *Language:* ${metadata.language || "N/A"}\n` +
      `│\n` +
      `╰──────────────────────┈\n\n` +
      `📥 *Fetching download links...*\n( ｡ • ̀ ω • ́ ｡ ) Please wait...`;

    if (metadata.thumbnail) {
      await ranuxPro.sendMessage(from, { image: { url: metadata.thumbnail }, caption: metaMsg }, { quoted: mek });
    } else {
      await ranuxPro.sendMessage(from, { text: metaMsg }, { quoted: mek });
    }

    const downloadLinks = await getPixeldrainLinks(selected.movieUrl);
    if (!downloadLinks.length) {
      return reply(
        `*❌ No direct download links found for this movie.*\n\n` +
        `This may be because:\n` +
        `• The movie page has no Pixeldrain links\n` +
        `• The download page is temporarily unavailable\n\n` +
        `Try searching for another quality or a different movie.`
      );
    }

    global.pendingMovie[sender] = {
      step: 2,
      movie: { metadata, downloadLinks },
      timestamp: Date.now()
    };

    const qualityText =
      `╭───〔 📥 *𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐋𝐈𝐒𝐓* 〕───┈\n` +
      `│\n` +
      `│ 🎬 *${metadata.title || selected.title}*\n` +
      `│ 📋 *${downloadLinks.length} quality option(s) available*\n` +
      `│ _(sorted best quality first)_\n` +
      `│\n` +
      `╰──────────────────────┈\n\n` +
      `*👇 Tap a quality to start downloading:*`;

    const qualityButtons = downloadLinks.map((d, i) =>
      btn(`mv_dl_${i + 1}`, `📥 ${d.quality}  •  ${d.size}`)
    );

    await sendBtn(ranuxPro, from, {
      text: qualityText,
      buttons: qualityButtons,
    }, { quoted: mek });

  } catch (e) {
    delete global.pendingMovie[sender];
    console.error("Movie Detail Fetch Error:", e.message);
    reply(`❌ *Failed to fetch movie details:* ${e.message || "Please try again."}`);
  }
});

// ─── Step 3: Download (button tap mv_dl_N) ────────────────────────────────────
cmd({
  filter: (body, { sender }) =>
    global.pendingMovie[sender] &&
    global.pendingMovie[sender].step === 2 &&
    /^mv_dl_\d+$/.test(body)
}, async (ranuxPro, mek, m, { body, sender, reply, from }) => {

  const index = parseInt(body.replace("mv_dl_", "")) - 1;
  const { movie } = global.pendingMovie[sender];

  if (index < 0 || index >= movie.downloadLinks.length) {
    return reply("❌ *Invalid quality selection. Please try again.*");
  }

  const selectedLink = movie.downloadLinks[index];
  delete global.pendingMovie[sender];

  if (global.activeMovieDownloads.size >= MAX_MOVIE_DOWNLOADS) {
    return reply(
      `*⏳ A movie download is already in progress.*\n\n` +
      `Please wait for it to finish before starting a new one.\n` +
      `_This prevents memory issues during large file uploads._`
    );
  }

  const directUrl = getDirectPixeldrainUrl(selectedLink.link);
  if (!directUrl) return reply("❌ *Could not generate a direct download link. The Pixeldrain URL may have changed.*");

  const knownSizeBytes = parseSizeToBytes(selectedLink.size);
  if (knownSizeBytes > 0) {
    const estimatedParts = Math.min(3, Math.ceil(knownSizeBytes / MOVIE_UPLOAD_MAX_BYTES));
    if (estimatedParts > 1) {
      await reply(
        `*📦 Large file detected (${selectedLink.size}).*\n` +
        `This movie will be downloaded and sent in *${estimatedParts} parts*. Please wait...`
      );
    }
  }

  const caption =
    `╭───〔 ✅ *𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐃* 〕───┈\n` +
    `│\n` +
    `│ 🎬 *Movie:* ${movie.metadata.title}\n` +
    `│ 📊 *Quality:* ${selectedLink.quality}\n` +
    `│ 💾 *Size:* ${selectedLink.size}\n` +
    `│\n` +
    `╰──────────────────────┈\n` +
    `🍿 *Enjoy the movie!*`;

  const fileName = `${movie.metadata.title.substring(0, 50)} - ${selectedLink.quality}.mp4`
    .replace(/[^\w\s.-]/gi, "");

  const tempPath = path.join("/tmp", `movie_${Date.now()}.mp4`);
  const movieTitle = movie.metadata.title || "Selected Movie";
  const progress = await sendLiveProgress(ranuxPro, from, mek, {
    title: movieTitle,
    quality: selectedLink.quality,
    size: selectedLink.size,
    downloadPercent: 0,
    uploadPercent: 0,
    stage: "Starting download...",
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSecond: 0
  });

  let uploadTimer = null;
  global.activeMovieDownloads.add(sender);

  try {
    progress.update({ downloadPercent: 0, uploadPercent: 0, stage: "Downloading film..." });
    const { downloadedBytes, totalBytes } = await downloadMovieToFile(directUrl, tempPath, update => {
      progress.update({ ...update, stage: "Downloading film..." });
    });

    const savedSize = fs.statSync(tempPath).size;

    progress.update({ downloadPercent: 100, uploadPercent: 0, downloadedBytes, totalBytes, stage: "Download complete. Uploading to chat..." });

    if (savedSize > MOVIE_UPLOAD_MAX_BYTES) {
      // Split into at most 3 parts regardless of how large the file is
      const partCount = Math.min(3, Math.ceil(savedSize / MOVIE_UPLOAD_MAX_BYTES));
      const dynamicPartSize = Math.ceil(savedSize / partCount);
      await sendSplitMovieParts(ranuxPro, from, mek, tempPath, fileName, caption, savedSize, progress, dynamicPartSize);
    } else {
      let uploadPercent = 0;
      uploadTimer = setInterval(() => {
        uploadPercent = Math.min(95, uploadPercent + 2);
        progress.update({ uploadPercent, stage: "Uploading film to chat..." });
      }, 1000);

      await ranuxPro.sendMessage(from, {
        video: { url: tempPath },
        mimetype: "video/mp4",
        fileName,
        caption
      }, { quoted: mek });
      clearInterval(uploadTimer);
      uploadTimer = null;
    }

    await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: "✅ Film sent to chat!" });

  } catch (error) {
    console.error("Movie Send Error:", error.message);
    if (uploadTimer) clearInterval(uploadTimer);
    await progress.stop({ stage: `❌ Failed: ${error.message || "Unknown error"}` });
    reply(`*❌ Failed to send movie:* ${error.message || "An unknown error occurred."}`);
  } finally {
    global.activeMovieDownloads.delete(sender);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// ─── Auto-cleanup stale sessions ──────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000;
  for (const sender in global.pendingMovie) {
    if (now - (global.pendingMovie[sender].timestamp || 0) > timeout) {
      delete global.pendingMovie[sender];
    }
  }
}, 5 * 60 * 1000);
