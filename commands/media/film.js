const { cmd } = require("../../command");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { sendBtn, btn } = require("../../utils/sendBtn");

// Patch Baileys upload timeout from 30s → 30 minutes so large files can upload
try {
  const baileys = require("@whiskeysockets/baileys");
  if (baileys.UPLOAD_TIMEOUT !== undefined) baileys.UPLOAD_TIMEOUT = 30 * 60 * 1000;
} catch (_) {}

// Global State
global.pendingMovie = global.pendingMovie || {};

// Design Elements
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";
const BASE_URL = "https://sinhalasub.lk";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function proxyFetch(url) {
  return axios.get(PROXY + encodeURIComponent(url), {
    timeout: 20000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  });
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

function renderProgressBar(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const width = 20;
  const filled = Math.round((safePercent / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${safePercent}%`;
}

function renderMovieProgress({ title, quality, size, percent, stage, downloadedBytes, totalBytes, startedAt }) {
  const downloaded = formatBytes(downloadedBytes);
  const total = formatBytes(totalBytes);
  const sizeLine = downloaded && total ? `│ 📦 *Progress:* ${downloaded} / ${total}\n` : "";
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return (
    `╭───〔 📥 *𝐌𝐎𝐕𝐈𝐄 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃* 〕───┈\n` +
    `│\n` +
    `│ 🎬 *Movie:* ${title}\n` +
    `│ 📊 *Quality:* ${quality}\n` +
    `│ 💾 *Size:* ${size}\n` +
    sizeLine +
    `│ ⏱️ *Time:* ${elapsedSeconds}s\n` +
    `│ ⚙️ *Status:* ${stage}\n` +
    `│ ${renderProgressBar(percent)}\n` +
    `│\n` +
    `╰──────────────────────┈\n` +
    `_This message updates every second until the film appears in chat._`
  );
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
  const { data } = await proxyFetch(url);
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
  const { data } = await proxyFetch(movieUrl);
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
  const { data } = await proxyFetch(movieUrl);
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
      const { data: linkData } = await proxyFetch(row.pageLink);
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
  return directLinks;
}

// ─── Step 1: Search ───────────────────────────────────────────────────────────
cmd({
  pattern: "movie",
  alias: ["sinhalasub", "films", "mv"],
  react: "🎬",
  desc: "Search and Download movies from Sinhalasub.lk",
  category: "download",
  filename: __filename
}, async (ranuxPro, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply(`*ℹ️ Please provide a movie name.*\n\n*Example:* \`.movie avatar\``);

  if (global.pendingMenu) delete global.pendingMenu[sender];
  if (global.pendingVideo) delete global.pendingVideo[sender];

  await reply(`*⏳ Searching for "${q}"...*`);

  try {
    const searchResults = await searchMovies(q);
    if (!searchResults.length) return reply("*❌ No movies found matching your query!*");

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
    reply("❌ *An error occurred during the search. Please try again later.*");
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
      return reply(`*❌ No direct download links found under 2GB!*`);
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
      `│\n` +
      `╰──────────────────────┈\n\n` +
      `*👇 Tap a quality to download:*`;

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
    reply("❌ *Failed to fetch movie details. Please try again.*");
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
    return reply("❌ *Invalid quality selection.*");
  }

  const selectedLink = movie.downloadLinks[index];
  delete global.pendingMovie[sender];

  const directUrl = getDirectPixeldrainUrl(selectedLink.link);
  if (!directUrl) return reply("❌ *Could not generate direct download link.*");

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
    percent: 0,
    stage: "Starting download...",
    downloadedBytes: 0,
    totalBytes: 0
  });

  let uploadTimer = null;

  try {
    const response = await axios({ method: "GET", url: directUrl, responseType: "stream", timeout: 0 });
    const totalBytes = Number(response.headers["content-length"]) || 0;
    let downloadedBytes = 0;
    progress.update({ totalBytes, stage: "Downloading film..." });

    response.data.on("data", chunk => {
      downloadedBytes += chunk.length;
      const percent = totalBytes ? Math.min(85, (downloadedBytes / totalBytes) * 85) : Math.min(85, 5 + (downloadedBytes / (1024 * 1024 * 1024)) * 80);
      progress.update({ percent, downloadedBytes, totalBytes, stage: "Downloading film..." });
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    progress.update({ percent: 90, downloadedBytes, totalBytes, stage: "Download complete. Uploading to chat..." });

    let uploadPercent = 90;
    uploadTimer = setInterval(() => {
      uploadPercent = Math.min(99, uploadPercent + 1);
      progress.update({ percent: uploadPercent, stage: "Uploading film to chat..." });
    }, 1000);

    const buffer = fs.readFileSync(tempPath);
    await ranuxPro.sendMessage(from, {
      document: buffer,
      mimetype: "video/mp4",
      fileName,
      caption
    }, { quoted: mek });
    clearInterval(uploadTimer);
    uploadTimer = null;
    await progress.stop({ percent: 100, stage: "Film sent to chat." });

  } catch (error) {
    console.error("Movie Send Error:", error.message);
    if (uploadTimer) clearInterval(uploadTimer);
    await progress.stop({ stage: "Failed to send film.", percent: 0 });
    reply(`*❌ Failed to send movie:* ${error.message || "An unknown error occurred."}`);
  } finally {
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
