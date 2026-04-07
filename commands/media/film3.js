/**
 * .film3 — SinhalaSub.lk movie search
 * sinhalasub.lk is protected by Cloudflare and blocks direct server scraping.
 * We search DuckDuckGo scoped to site:sinhalasub.lk to get real movie URLs,
 * then present those links as tap-to-open buttons.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const SITE    = 'sinhalasub.lk';
const DDG_URL = 'https://html.duckduckgo.com/html/';
const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── 5-min session store ───────────────────────────────────────────────────────
const sessions = new Map();
function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

// ── Emoji reaction helper ─────────────────────────────────────────────────────
async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

// ── DuckDuckGo search scoped to sinhalasub.lk ─────────────────────────────────
async function searchSinhalaSub(query) {
  const params = new URLSearchParams({
    q: `site:${SITE} ${query}`,
    kl: 'us-en',
    ia: 'web',
  });

  const res = await axios.post(DDG_URL, params.toString(), {
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const results = [];
  const seen    = new Set();

  $('.result__body').each((_, el) => {
    if (results.length >= 5) return;
    const $el    = $(el);
    const $link  = $el.find('a.result__a').first();
    const rawUrl = $link.attr('href') || '';
    const title  = $link.text().trim();

    // DDG wraps URLs; extract the real one
    let url = rawUrl;
    try {
      const u    = new URL(rawUrl, 'https://duckduckgo.com');
      const uddg = u.searchParams.get('uddg') || u.searchParams.get('u');
      if (uddg) url = decodeURIComponent(uddg);
    } catch (_) {}

    if (!url.includes(SITE)) return;
    if (seen.has(url)) return;
    seen.add(url);

    const snippet = $el.find('.result__snippet').text().trim().slice(0, 120) || null;
    results.push({ title: title || url, url, snippet });
  });

  return results;
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
  name: 'film3',
  aliases: ['sinhalasub', 'film3sel', 'film3select'],
  category: 'media',
  description: 'Search SinhalaSub.lk for movies with Sinhala subtitles',
  usage: 'film3 <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ── film3sel: show details for a selected result ─────────────────────────
    if (cmdName === 'film3sel' || cmdName === 'film3select') {
      const idx     = parseInt(args[0], 10);
      const session = sessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const movie = session[idx];
      let text = '';
      text += `🎬 *${movie.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (movie.snippet) text += `📖 ${movie.snippet}\n\n`;
      text += `🔗 *Link:*\n${movie.url}\n\n`;
      text += `> 🎬 _Infinity MD Mini • SinhalaSub.lk_`;

      return sendBtn(sock, chatId, {
        text,
        footer: '♾️ Infinity MD Mini • SinhalaSub.lk',
        buttons: [
          urlBtn('🌐 Open Page', movie.url),
          btn('film3', '🔍 New Search'),
        ],
      }, { quoted: msg });
    }

    // ── film3: search ─────────────────────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *SinhalaSub.lk Film Search*\n\nUsage: \`${prefix}film3 <movie name>\`\nExample: \`${prefix}film3 Avengers\`\n\n_Finds movies from sinhalasub.lk with Sinhala subtitles._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    let results;
    try {
      results = await searchSinhalaSub(query);
    } catch (err) {
      console.error('[film3] search error:', err.message);
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `❌ Search failed. Please try again in a moment.`,
      }, { quoted: msg });
    }

    if (!results.length) {
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"* on SinhalaSub.lk.\n\nTry a shorter or different keyword.`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(sessions, chatId, results);

    let text = `🎬 *SinhalaSub.lk Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}\n`;
      if (m.snippet) text += `   _${m.snippet.slice(0, 80)}${m.snippet.length > 80 ? '…' : ''}_\n`;
      text += `\n`;
    });
    text += `💡 *Tap a button to open the movie page*\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`;

    const pickBtns = results.map((m, i) =>
      btn(`film3sel_${i}`, `${i + 1}. ${m.title.slice(0, 22)}`)
    );

    return sendBtn(sock, chatId, {
      text,
      footer: '♾️ Infinity MD Mini • sinhalasub.lk',
      buttons: pickBtns,
    }, { quoted: msg });
  },
};
