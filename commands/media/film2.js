const { cmd } = require("../../command");
const axios = require("axios");
const cheerio = require("cheerio");
const { sendBtn, btn } = require("../../utils/sendBtn");

// Global State (separate namespace from film.js)
global.pendingMovie2 = global.pendingMovie2 || {};

// Config
const BASE_URL = "https://baiscopedownloads.link";
const LOGO_URL 

  ";

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
  "mega.nz": "🟠 MEGA",
  "mediafire": "🟡 Mediafire",
  "drive.google": "🔵 Google Drive",
  "tinyurl": "🔗 Mirror Link",
  "1fichier": "🟤 1Fichier",
};

// Quality sort order (higher = better)
const QUALITY_ORDER = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function proxyFetch2(url, retries = 3) {
  // Return cached result if still fresh
  const cached = proxyCache2.get(url);
  if (cached && Date.now() < cached.expiry) {
    return cached.response;
  }

  let lastError;
  const now = () => Date.now();
  let realAttempts = 0;
  let proxySkips = 0;

  while (realAttempts < retries) {
    // Pick the first proxy not currently in cooldown
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
  let currentQuality = null;
  let currentSize = null;

  const contentEl = $(".elementor-widget-theme-post-content, .entry-content, .post-content, .elementor-widget-container");
  const contentHtml = contentEl.length ? contentEl.html() : $("body").html();
  const $c = cheerio.load(contentHtml || "");

  $c("p, h2, h3, div").each((i, el) => {
    const text = $c(el).text().replace(/\s+/g, " ").trim();
    const elLinks = [];

    $c(el).find("a[href]").each((j, a) => {
      const href = $c(a).attr("href");
      if (isExternalDownloadLink(href)) elLinks.push(href);
    });

    const qualityMatch = text.match(/(?:720p|1080p|480p|4K|2160p)/i);
    const sizeMatch = text.match(/([\d.]+)\s*(GB|MB)/i);
    const isQualityLabel = qualityMatch && text.includes("|") && text.length < 150;

    if (isQualityLabel) {
      currentQuality = qualityMatch[0].replace(/4k/i, "4K");
      currentSize = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : "N/A";
    }

    if (elLinks.length > 0 && currentQuality) {
      const existing = downloadOptions.find(
        d => d.quality === currentQuality && d.size === currentSize
      );
      if (existing) {
        for (const link of elLinks) {
          if (!existing.links.includes(link)) existing.links.push(link);
        }
      } else {
        downloadOptions.push({ quality: currentQuality, size: currentSize, links: elLinks });
      }
    }
  });

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

  const linkLines = selected.links.map(url =>
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

// Periodically clean expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of proxyCache2.entries()) {
    if (now >= val.expiry) proxyCache2.delete(key);
  }
}, 10 * 60 * 1000);
