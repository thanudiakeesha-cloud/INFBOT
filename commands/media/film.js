const { cmd } = require("../../command");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const config = require("../../config");
const { execSync } = require("child_process");
const { sendBtn, btn, urlBtn } = require("../../utils/sendBtn");

puppeteerExtra.use(StealthPlugin());

// Global State
global.pendingMovie = global.pendingMovie || {};

// Design Elements
const LOGO_URL = "https://files.catbox.moe/2jt3ln.png";
const FOOTER = `> 👑 ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋɪɴɢ ʀᴀɴᴜx ᴘʀᴏ`;

// ─── Chromium Detection ───────────────────────────────────────────────────────
let CHROMIUM_PATH;
try {
  CHROMIUM_PATH = execSync("which chromium || which chromium-browser || which google-chrome", { encoding: "utf8" }).trim().split("\n")[0];
} catch (_) {
  CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
}
const PUPPETEER_OPTS = {
  headless: true,
  executablePath: CHROMIUM_PATH,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-size=1280,800"
  ]
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function newStealthPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 800 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  });
  return page;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeQuality(text) {
  if (!text) return null;
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

// ─── Scrapers ─────────────────────────────────────────────────────────────────
async function searchMovies(query) {
  const searchUrl = `https://sinhalasub.lk/?s=${encodeURIComponent(query)}&post_type=movies`;
  const browser = await puppeteerExtra.launch(PUPPETEER_OPTS);
  const page = await newStealthPage(browser);
  try {
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 45000 });
    // Check if blocked by Cloudflare
    const pageTitle = await page.title();
    if (pageTitle.includes("Attention Required") || pageTitle.includes("Just a moment")) {
      await new Promise(r => setTimeout(r, 8000));
      await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
    }
    const results = await page.$$eval(".display-item .item-box", boxes =>
      boxes.slice(0, 8).map((box, index) => {
        const a = box.querySelector("a");
        return {
          id: index + 1,
          title: a?.title?.trim() || a?.textContent?.trim() || "Unknown Title",
          movieUrl: a?.href || "",
        };
      }).filter(m => m.title && m.movieUrl)
    );
    await browser.close();
    return results;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function getMovieMetadata(url) {
  const browser = await puppeteerExtra.launch(PUPPETEER_OPTS);
  const page = await newStealthPage(browser);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    const pageTitle = await page.title();
    if (pageTitle.includes("Attention Required") || pageTitle.includes("Just a moment")) {
      await new Promise(r => setTimeout(r, 8000));
      await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
    }
    const metadata = await page.evaluate(() => {
      const getText = el => el?.textContent.trim() || "";
      const getList = selector => Array.from(document.querySelectorAll(selector)).map(el => el.textContent.trim());
      const title = getText(document.querySelector(".info-details .details-title h3"));
      let language = "N/A", directors = [];
      document.querySelectorAll(".info-col p").forEach(p => {
        const strong = p.querySelector("strong");
        if (!strong) return;
        const txt = strong.textContent.trim();
        if (txt.includes("Language:")) language = strong.nextSibling?.textContent?.trim() || "N/A";
        if (txt.includes("Director:")) directors = Array.from(p.querySelectorAll("a")).map(a => a.textContent.trim());
      });
      const duration = getText(document.querySelector(".info-details .data-views[itemprop='duration']")) || "N/A";
      const imdb = getText(document.querySelector(".info-details .data-imdb"))?.replace("IMDb:", "").trim() || "N/A";
      const genres = getList(".details-genre a");
      const thumbnail = document.querySelector(".splash-bg img")?.src || "";
      return { title, language, duration, imdb, genres, directors, thumbnail };
    });
    await browser.close();
    return metadata;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function getPixeldrainLinks(movieUrl) {
  const browser = await puppeteerExtra.launch(PUPPETEER_OPTS);
  const page = await newStealthPage(browser);
  try {
    await page.goto(movieUrl, { waitUntil: "networkidle2", timeout: 60000 });
    const pageTitle = await page.title();
    if (pageTitle.includes("Attention Required") || pageTitle.includes("Just a moment")) {
      await new Promise(r => setTimeout(r, 8000));
      await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
    }
    const linksData = await page.$$eval(".link-pixeldrain tbody tr", rows =>
      rows.map(row => {
        const a = row.querySelector(".link-opt a");
        const quality = row.querySelector(".quality")?.textContent.trim() || "";
        const size = row.querySelector("td:nth-child(3) span")?.textContent.trim() || "";
        return { pageLink: a?.href || "", quality, size };
      })
    );
    const directLinks = [];
    for (const l of linksData) {
      try {
        const subPage = await newStealthPage(browser);
        await subPage.goto(l.pageLink, { waitUntil: "networkidle2", timeout: 45000 });
        await new Promise(r => setTimeout(r, 12000));
        const finalUrl = await subPage.$eval(".wait-done a[href^='https://pixeldrain.com/']", el => el.href).catch(() => null);
        if (finalUrl) {
          let sizeMB = 0;
          const sizeText = l.size.toUpperCase();
          if (sizeText.includes("GB")) sizeMB = parseFloat(sizeText) * 1024;
          else if (sizeText.includes("MB")) sizeMB = parseFloat(sizeText);
          if (sizeMB > 0 && sizeMB <= 2048) {
            directLinks.push({ link: finalUrl, quality: normalizeQuality(l.quality), size: l.size });
          }
        }
        await subPage.close();
      } catch (e) { continue; }
    }
    await browser.close();
    return directLinks;
  } catch (e) {
    await browser.close();
    throw e;
  }
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
      footer: FOOTER,
      buttons: movieButtons,
    }, { quoted: mek });

  } catch (e) {
    console.error("Movie Search Error:", e);
    reply("❌ *An error occurred during the search. Please try again later.*");
  }
});

// ─── Step 2: Movie Details (triggered by button tap mv_select_N) ──────────────
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
      delete global.pendingMovie[sender];
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
      footer: FOOTER,
      buttons: qualityButtons,
    }, { quoted: mek });

  } catch (e) {
    delete global.pendingMovie[sender];
    console.error("Movie Detail Fetch Error:", e);
    reply("❌ *Failed to fetch movie details. The website might be down.*");
  }
});

// ─── Step 3: Download (triggered by button tap mv_dl_N) ───────────────────────
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

  await reply(`*🚀 Download initiated for "${movie.metadata.title}" (${selectedLink.quality}). Please wait...*`);

  try {
    const directUrl = getDirectPixeldrainUrl(selectedLink.link);
    if (!directUrl) throw new Error("Could not generate direct download link.");

    const fileName = `${movie.metadata.title.substring(0, 50)} - ${selectedLink.quality}.mp4`.replace(/[^\w\s.-]/gi, '');
    const caption =
      `╭───〔 ✅ *𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐃* 〕───┈\n` +
      `│\n` +
      `│ 🎬 *Movie:* ${movie.metadata.title}\n` +
      `│ 📊 *Quality:* ${selectedLink.quality}\n` +
      `│ 💾 *Size:* ${selectedLink.size}\n` +
      `│\n` +
      `╰──────────────────────┈\n` +
      `🍿 *Enjoy the movie!*\n\n` +
      FOOTER;

    await ranuxPro.sendMessage(from, {
      document: { url: directUrl },
      mimetype: "video/mp4",
      fileName,
      caption
    }, { quoted: mek });

  } catch (error) {
    console.error("Movie Send Error:", error);
    reply(`*❌ Failed to send movie:* ${error.message || "An unknown error occurred."}`);
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
