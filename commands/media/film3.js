/**
 * .film3 — Sinhala Subtitle Search via DuckDuckGo
 * sinhalasub.lk is protected by Cloudflare (403) and unindexed by DDG.
 * We search DuckDuckGo broadly for "{query} sinhala subtitles" and return
 * the best results from known Sinhala movie/subtitle sites.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');

const DDG_URL = 'https://html.duckduckgo.com/html/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SINHALA_DOMAINS = [
  'sinhalasub.lk',
  'cinesubz.net',
  'srihub.store',
  'baiscopelk.com',
  'baiscope.lk',
  'sinhalasubtitles.lk',
  'subf2m.co',
  'opensubtitles.com',
  'opensubtitles.org',
];

const sessions = new Map();
function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

function extractDdgUrl(rawHref) {
  if (!rawHref) return '';
  try {
    if (rawHref.startsWith('//duckduckgo.com/l/') || rawHref.startsWith('/l/')) {
      const base = rawHref.startsWith('/') ? 'https://duckduckgo.com' + rawHref : 'https:' + rawHref;
      const u = new URL(base);
      const uddg = u.searchParams.get('uddg') || u.searchParams.get('u');
      if (uddg) return decodeURIComponent(uddg);
    }
    if (rawHref.startsWith('http')) return rawHref;
    const u = new URL(rawHref, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg') || u.searchParams.get('u');
    if (uddg) return decodeURIComponent(uddg);
  } catch (_) {}
  return rawHref;
}

function isSinhalaUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return SINHALA_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch (_) {
    return false;
  }
}

async function searchSinhala(query) {
  const ddgQuery = `${query} sinhala subtitles`;

  const params = new URLSearchParams({
    q: ddgQuery,
    kl: 'us-en',
    ia: 'web',
  });

  const res = await axios.post(DDG_URL, params.toString(), {
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const results = [];
  const seen = new Set();

  const resultSelectors = ['div.result', '.result__body', '.results_links', '.web-result'];
  let $results = $([]);
  for (const sel of resultSelectors) {
    const found = $(sel);
    if (found.length > 0) { $results = found; break; }
  }

  $results.each((_, el) => {
    if (results.length >= 5) return;
    const $el = $(el);
    const $link = $el.find('a.result__a, a.result-link, h2 a, .result__title a').first();
    const rawUrl = $link.attr('href') || '';
    const title  = $link.text().trim();
    const url = extractDdgUrl(rawUrl);
    if (!url || !url.startsWith('http')) return;
    if (seen.has(url)) return;
    seen.add(url);

    const snippet = $el.find('.result__snippet, .result-snippet, .snippet').text().trim().slice(0, 120) || null;
    const preferred = isSinhalaUrl(url);
    results.push({ title: title || url, url, snippet, preferred });
  });

  if (results.length === 0) {
    $('a[href]').each((_, el) => {
      if (results.length >= 5) return;
      const rawHref = $(el).attr('href') || '';
      const url = extractDdgUrl(rawHref);
      if (!url || !url.startsWith('http') || url.includes('duckduckgo.com')) return;
      if (seen.has(url)) return;
      seen.add(url);
      const title = $(el).text().trim() || url;
      const preferred = isSinhalaUrl(url);
      results.push({ title, url, snippet: null, preferred });
    });
  }

  results.sort((a, b) => (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0));
  return results.slice(0, 5);
}

module.exports = {
  name: 'film3',
  aliases: ['sinhalasub', 'film3sel', 'film3select'],
  category: 'media',
  description: 'Search for Sinhala subtitle movie links via web search',
  usage: 'film3 <movie name>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    if (cmdName === 'film3sel' || cmdName === 'film3select') {
      const idx     = parseInt(args[0], 10);
      const session = sessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const movie = session[idx];
      let text = `🎬 *${movie.title}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (movie.snippet) text += `📖 ${movie.snippet}\n\n`;
      text += `🔗 *Link:*\n${movie.url}\n\n`;
      text += `> 🎬 _Infinity MD Mini • Sinhala Subtitles_`;

      return sendBtn(sock, chatId, {
        text,
        footer: '♾️ Infinity MD Mini • Sinhala Subtitles',
        buttons: [
          urlBtn('🌐 Open Page', movie.url),
          btn('film3', '🔍 New Search'),
        ],
      }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: `🎬 *Sinhala Subtitle Search*\n\nUsage: \`${prefix}film3 <movie name>\`\nExample: \`${prefix}film3 Avengers\`\n\n_Finds Sinhala subtitle movie links from the web._`,
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    let results;
    try {
      results = await searchSinhala(query);
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
        text: `😔 No results found for *"${query}"*.\n\nTry a shorter or different keyword.`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(sessions, chatId, results);

    let text = `🎬 *Sinhala Subtitle Results*\n🔍 _"${query}"_ — ${results.length} found\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    results.forEach((m, i) => {
      text += `*${i + 1}.* ${m.title}\n`;
      if (m.snippet) text += `   _${m.snippet.slice(0, 80)}${m.snippet.length > 80 ? '…' : ''}_\n`;
      text += `\n`;
    });
    text += `💡 *Tap a button to open the movie page*\n> 🎬 _Infinity MD Mini • Sinhala Subtitles_`;

    const pickBtns = results.map((m, i) =>
      btn(`film3sel_${i}`, `${i + 1}. ${m.title.slice(0, 22)}`)
    );

    return sendBtn(sock, chatId, {
      text,
      footer: '♾️ Infinity MD Mini • Sinhala Subtitles',
      buttons: pickBtns,
    }, { quoted: msg });
  },
};
