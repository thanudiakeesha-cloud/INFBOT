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

// Global State
global.pendingMovie = global.pendingMovie || {};
global.activeMovieDownloads = global.activeMovieDownloads || new Set();

// Design Elements
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";
const BASE_URL = "https://sinhalasub.lk";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";
const DOWNLOAD_HIGH_WATER_MARK = 2 * 1024 * 1024;
const MAX_MOVIE_DOWNLOADS = Math.max(1, Number(process.env.MAX_MOVIE_DOWNLOADS) || 1);
const MOVIE_UPLOAD_MAX_MB = Math.max(10, Number(process.env.MOVIE_UPLOAD_MAX_MB) || 64);
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
  const safeDownloadPercent = downloadPercent ?? percent ?? 0;
  const safeUploadPercent = uploadPercent ?? 0;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  const downloaded = formatBytes(downloadedBytes);
  const total = formatBytes(totalBytes);
  const speed = formatBytes(speedBytesPerSecond);

  // ETA
  let eta = "";
  if (speedBytesPerSecond > 0 && totalBytes > 0 && downloadedBytes > 0 && safeDownloadPercent < 100) {
    eta = formatEta((totalBytes - downloadedBytes) / speedBytesPerSecond);
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
        `│  ${renderProgressBar(safeUploadPercent)}\n`
      : `│  ⬇️ *Downloading...*\n` +
        `│  ${renderProgressBar(safeDownloadPercent)}\n` +
        (progressLine ? `│  ${progressLine}\n` : "")
    ) +
    `│\n` +
    `│  ⏱️ ${elapsedSeconds}s  •  ${stage}\n` +
    `╰─────────────────────────╯`
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

async function getVideoDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    filePath
  ]);
  const info = JSON.parse(stdout);
  return parseFloat(info.format.duration);
}

async function splitVideoWithFfmpeg(inputPath, partCount, baseTitle) {
  const duration = await getVideoDuration(inputPath);
  const partDuration = duration / partCount;
  const partPaths = [];

  for (let i = 0; i < partCount; i++) {
    const startTime = i * partDuration;
    const partPath = `/tmp/movie_part${String(i + 1).padStart(2, "0")}of${String(partCount).padStart(2, "0")}_${Date.now()}.mp4`;
    const args = [
      "-ss", String(startTime),
      "-i", inputPath,
      "-t", String(partDuration),
      "-c", "copy",
      "-avoid_negative_ts", "1",
      "-y",
      partPath
    ];
    await execFileAsync("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
    partPaths.push(partPath);
  }
  return partPaths;
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
        `╭─────────────────────────╮\n` +
        `│  📦 *Sending in ${partCount} Parts*\n` +
        `│\n` +
        `│  Each part: ~${formatBytes(bytesPerPart)}\n` +
        `│\n` +
        `│  ⚠️ *How to watch:*\n` +
        `│  1. Download all ${partCount} parts\n` +
        `│  2. Join them using HJSplit (Windows)\n` +
        `│     or: cat part1 part2 > movie.mp4\n` +
        `│  3. Open the joined .mp4 file\n` +
        `╰─────────────────────────╯`
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
        mimetype: "application/octet-stream",
        fileName: partFileName,
        caption:
          `${baseCaption}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 Part *${partNumber} of ${partCount}*\n` +
          `📏 Size: ${formatBytes(end - start + 1)}\n` +
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
    `🎬 *Movie Downloader*\n\n` +
    `Usage: \`.movie <title>\`\n` +
    `Example: \`.movie avatar\`\n\n` +
    `_Also works with:_ .film | .mv | .films`
  );

  if (global.pendingMenu) delete global.pendingMenu[sender];
  if (global.pendingVideo) delete global.pendingVideo[sender];
  if (global.pendingMovie[sender]) delete global.pendingMovie[sender];

  await reply(`🔍 Searching for *"${q}"*...`);

  try {
    const searchResults = await searchMovies(q);
    if (!searchResults.length) return reply(
      `❌ *No results for "${q}"*\n\n` +
      `Try a shorter or different title.\n` +
      `_Example:_ .movie avatar`
    );

    global.pendingMovie[sender] = { step: 1, results: searchResults, timestamp: Date.now() };

    const text =
      `╭─────────────────────────╮\n` +
      `│  🎬 *Movie Search*\n` +
      `│\n` +
      `│  🔍 "${q}"\n` +
      `│  Found *${searchResults.length}* result(s)\n` +
      `│\n` +
      `│  👇 Tap a title to select\n` +
      `╰─────────────────────────╯`;

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
    reply(`❌ Search failed. Please try again.\n_${e.message || ""}_`);
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
    reply("✅ *Cancelled.* Start a new search anytime with `.movie <title>`");
  } else {
    reply("ℹ️ No active movie session to cancel.");
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
    await reply(`⏳ Loading *"${selected.title}"*...`);
    const metadata = await getMovieMetadata(selected.movieUrl);

    const title = metadata.title || selected.title;
    const metaMsg =
      `╭─────────────────────────╮\n` +
      `│  🎬 *${title}*\n` +
      `│\n` +
      `│  ⭐ IMDb: ${metadata.imdb}\n` +
      `│  🕒 ${metadata.duration}\n` +
      `│  🎭 ${metadata.genres.join(", ") || "N/A"}\n` +
      `│  🌐 ${metadata.language || "N/A"}\n` +
      (metadata.directors.length ? `│  🎥 ${metadata.directors.join(", ")}\n` : "") +
      `│\n` +
      `│  ⏳ Loading download options...\n` +
      `╰─────────────────────────╯`;

    if (metadata.thumbnail) {
      await ranuxPro.sendMessage(from, { image: { url: metadata.thumbnail }, caption: metaMsg }, { quoted: mek });
    } else {
      await ranuxPro.sendMessage(from, { text: metaMsg }, { quoted: mek });
    }

    const downloadLinks = await getPixeldrainLinks(selected.movieUrl);
    if (!downloadLinks.length) {
      return reply(
        `❌ *No download links found for this movie.*\n\n` +
        `The movie site may not have upload links yet.\n` +
        `Try a different movie or search again later.`
      );
    }

    global.pendingMovie[sender] = {
      step: 2,
      movie: { metadata, downloadLinks },
      timestamp: Date.now()
    };

    const qualityText =
      `╭─────────────────────────╮\n` +
      `│  📥 *Choose Quality*\n` +
      `│\n` +
      `│  🎬 ${title}\n` +
      `│  ${downloadLinks.length} option(s) — best quality first\n` +
      `│\n` +
      `│  👇 Tap to start download\n` +
      `╰─────────────────────────╯`;

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
    reply(`❌ Couldn't load this movie. Please try again.\n_${e.message || ""}_`);
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
      `⏳ *Another download is running.*\n\n` +
      `Please wait for it to finish, then try again.`
    );
  }

  const directUrl = getDirectPixeldrainUrl(selectedLink.link);
  if (!directUrl) return reply("❌ Download link not available. Please try a different quality.");

  const knownSizeBytes = parseSizeToBytes(selectedLink.size);
  if (knownSizeBytes > MOVIE_UPLOAD_MAX_BYTES) {
    const estimatedParts = Math.min(3, Math.ceil(knownSizeBytes / MOVIE_UPLOAD_MAX_BYTES));
    await reply(
      `📦 *Large file (${selectedLink.size})*\n` +
      `Will be sent in *${estimatedParts} parts* — tap each to download & play.\n` +
      `Downloading now, please wait... ☕`
    );
  }

  const caption =
    `╭─────────────────────────╮\n` +
    `│  ✅ *Movie Ready!*\n` +
    `│\n` +
    `│  🎬 ${movie.metadata.title}\n` +
    `│  📊 ${selectedLink.quality}  •  ${selectedLink.size}\n` +
    `│\n` +
    `│  🍿 Enjoy watching!\n` +
    `╰─────────────────────────╯`;

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

    progress.update({ downloadPercent: 100, uploadPercent: 0, downloadedBytes, totalBytes, stage: "Done! Sending to chat..." });

    if (savedSize > MOVIE_UPLOAD_MAX_BYTES) {
      const partCount = Math.min(3, Math.ceil(savedSize / MOVIE_UPLOAD_MAX_BYTES));

      progress.update({ downloadPercent: 100, uploadPercent: 0, stage: `Splitting into ${partCount} parts...` });

      const partPaths = await splitVideoWithFfmpeg(tempPath, partCount, movie.metadata.title);

      await ranuxPro.sendMessage(from, {
        text:
          `╭─────────────────────────╮\n` +
          `│  🎬 *${movie.metadata.title}*\n` +
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

        await ranuxPro.sendMessage(from, {
          document: { url: partPaths[i] },
          mimetype: "video/mp4",
          fileName: `${movie.metadata.title} - Part ${partNum} of ${partCount}.mp4`,
          caption:
            `${caption}\n\n` +
            `📥 *Part ${partNum} of ${partCount}* — tap to download, then play`
        }, { quoted: mek });

        clearInterval(uploadTimer);
        uploadTimer = null;

        if (fs.existsSync(partPaths[i])) fs.unlinkSync(partPaths[i]);
      }

      await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: `All ${partCount} parts sent! 🍿` });

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

      await progress.stop({ downloadPercent: 100, uploadPercent: 100, stage: "Sent! 🍿" });
    }

  } catch (error) {
    console.error("Movie Send Error:", error.message);
    console.error("Movie Send Stack:", error.stack);
    if (uploadTimer) clearInterval(uploadTimer);
    await progress.stop({ stage: `Failed ❌` });
    reply(`❌ *Failed to send movie.*\nError: ${error.message}\nPlease try again or choose a different quality.`);
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
