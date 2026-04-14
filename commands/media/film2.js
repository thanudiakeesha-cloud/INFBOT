const { cmd } = require("../../command");
const axios = require("axios");
const cheerio = require("cheerio");
const { sendBtn, btn } = require("../../utils/sendBtn");

// Global State (separate namespace from film.js)
global.pendingMovie2 = global.pendingMovie2 || {};

// Config
const BASE_URL = "https://baiscopedownloads.link";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";

// Download hosts priority order for display
const HOST_LABELS = {
  "usersdrive": "🟢 UsersDrive",
  "dgdrive": "🔵 DGDrive",
  "filepv": "🟣 FilePV",
  "mega.nz": "🟠 MEGA",
  "mediafire": "🟡 Mediafire",
  "drive.google": "🔵 Google Drive",
  "tinyurl": "🔗 Mirror Link",
  "1fichier": "🟤 1Fichier",
};

// Quality sort order (higher = better)
const QUALITY_ORDER = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function proxyFetch(url, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios.get(PROXY + encodeURIComponent(url), {
        timeout: 25000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1500 * attempt));
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

// ─── Scrapers ─────────────────────────────────────────────────────────────────
async function searchMovies2(query) {
  const { data } = await proxyFetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
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
  const { data } = await proxyFetch(movieUrl);
  const $ = cheerio.load(data);

  // Title
  const title = $("h1.elementor-heading-title").first().text().trim()
    || $("h1").first().text().trim()
    || $("title").text().replace(/[–\-].*$/, "").trim();

  // Thumbnail - try several selectors
  const thumbnail =
    $(".elementor-widget-theme-post-featured-image img").first().attr("src")
    || $(".wp-post-image").attr("src")
    || $("meta[property='og:image']").attr("content")
    || $("article img").first().attr("src")
    || "";

  // Parse download section: quality label paragraphs + download link paragraphs
  // Pattern: paragraph with "| ... | 720p | 2GB |" followed by paragraph(s) with external links
  const downloadOptions = [];
  let currentQuality = null;
  let currentSize = null;

  const contentEl = $(".elementor-widget-theme-post-content, .entry-content, .post-content, .elementor-widget-container");
  const contentHtml = contentEl.length ? contentEl.html() : $("body").html();
  const $c = cheerio.load(contentHtml || "");

  $c("p, h2, h3, div").each((i, el) => {
    const text = $c(el).text().replace(/\s+/g, " ").trim();
    const elLinks = [];

    // Extract all external links from this element
    $c(el).find("a[href]").each((j, a) => {
      const href = $c(a).attr("href");
      if (isExternalDownloadLink(href)) elLinks.push(href);
    });

    // Check if this element is a quality label
    const qualityMatch = text.match(/(?:720p|1080p|480p|4K|2160p)/i);
    const sizeMatch = text.match(/([\d.]+)\s*(GB|MB)/i);
    const isQualityLabel = qualityMatch && text.includes("|") && text.length < 150;

    if (isQualityLabel) {
      currentQuality = qualityMatch[0].replace(/4k/i, "4K");
      currentSize = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : "N/A";
    }

    // If we found external links and have a quality context, record them
    if (elLinks.length > 0 && currentQuality) {
      const existing = downloadOptions.find(
        d => d.quality === currentQuality && d.size === currentSize
      );
      if (existing) {
        // Add new unique links
        for (const link of elLinks) {
          if (!existing.links.includes(link)) existing.links.push(link);
        }
      } else {
        downloadOptions.push({ quality: currentQuality, size: currentSize, links: elLinks });
      }
    }
  });

  // Sort by quality
  downloadOptions.sort((a, b) => (QUALITY_ORDER[b.quality] || 0) - (QUALITY_ORDER[a.quality] || 0));

  return { title, thumbnail, downloadOptions };
}

// ─── Step 1: Search ───────────────────────────────────────────────────────────
cmd({
  pattern: "baiscope",
  alias: ["bs", "film2", "baiscopelk"],
  react: "🎬",
  desc: "Search and get download links for movies from Baiscopedownloads.link",
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
      `│  👇 Tap a quality below\n` +
      `╰─────────────────────────╯`;

    const qualityButtons = details.downloadOptions.map((d, i) =>
      btn(`bs_dl_${i + 1}`, `📥 ${d.quality}  •  ${d.size}`)
    );

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
        `│  👇 Tap to get download links\n` +
        `╰─────────────────────────╯`,
      buttons: qualityButtons,
    }, { quoted: mek });

  } catch (e) {
    delete global.pendingMovie2[sender];
    console.error("Baiscope Detail Error:", e.message);
    reply(`❌ Couldn't load this movie. Please try again.\n_${e.message || ""}_`);
  }
});

// ─── Step 3: Send Download Links ──────────────────────────────────────────────
cmd({
  filter: (body, { sender }) =>
    global.pendingMovie2[sender] &&
    global.pendingMovie2[sender].step === 2 &&
    /^bs_dl_\d+$/.test(body)
}, async (ranuxPro, mek, m, { body, sender, reply, from }) => {

  await ranuxPro.sendMessage(from, { react: { text: "🔗", key: mek.key } });

  const index = parseInt(body.replace("bs_dl_", "")) - 1;
  const { movie } = global.pendingMovie2[sender];

  if (index < 0 || index >= movie.downloadOptions.length) {
    return reply("❌ *Invalid selection.* Please search again.");
  }

  const selected = movie.downloadOptions[index];
  delete global.pendingMovie2[sender];

  // Build a clean link list
  const linkLines = selected.links.map((url, i) =>
    `${getHostLabel(url)}\n${url}`
  ).join("\n\n");

  const msg =
    `╭─────────────────────────╮\n` +
    `│  🔗 *Download Links*\n` +
    `│\n` +
    `│  🎬 ${movie.title}\n` +
    `│  📊 ${selected.quality}  •  ${selected.size}\n` +
    `│\n` +
    `│  *${selected.links.length} server(s) available*\n` +
    `╰─────────────────────────╯\n\n` +
    linkLines + "\n\n" +
    `_Tap any link above to open the download page._\n` +
    `_If one server is slow, try another one._`;

  await ranuxPro.sendMessage(from, { text: msg }, { quoted: mek });
  await ranuxPro.sendMessage(from, { react: { text: "✅", key: mek.key } });
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
