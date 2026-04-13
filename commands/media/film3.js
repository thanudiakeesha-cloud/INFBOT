/**
 * .film3   — SinhalaSub.lk scraper (axios-based, no Puppeteer)
 * .film3tb — Fast TeraBox direct download (resolves share URL → sends file in ~1 min)
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const axios = require('axios');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');
const { downloadAndSend, resolveTeraBox, isTeraBox } = require('../../utils/filmDownloader');
const { searchMovies, getMovieDetails, isTeraBoxUrl, cleanTitle } = require('../../utils/sinhalasub');

const searchSessions = new Map();
const detailSessions = new Map();

function setTTL(map, key, value, ms = 5 * 60 * 1000) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ms);
}

async function react(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

function formatBytes(b) {
  if (!b || b <= 0) return '?';
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  return (b / 1e6).toFixed(1) + ' MB';
}

// ── Fast TeraBox download ─────────────────────────────────────────────────────
async function sendTeraBoxFast(sock, chatId, msg, shareUrl, movieTitle) {
  const statusMsg = await sock.sendMessage(chatId, {
    text: `⏳ *Resolving TeraBox link...*\n\n🎬 *${movieTitle || 'Movie'}*\n\n_This usually takes under a minute..._`,
  }, { quoted: msg });

  const edit = async (text) => {
    try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }); } catch (_) {}
  };
  const delStatus = async () => {
    try { await sock.sendMessage(chatId, { delete: statusMsg.key }); } catch (_) {}
  };

  let tbResult;
  try {
    tbResult = await resolveTeraBox(shareUrl);
  } catch (err) {
    console.error('[film3tb] resolveTeraBox error:', err.message);
  }

  if (!tbResult?.url) {
    await edit(
      `❌ *Could not resolve TeraBox link.*\n\n` +
      `_The share link may be expired or the file is private._\n\n` +
      `🔗 Try opening manually:\n${shareUrl}\n\n> 🎬 _Infinity MD Mini_`
    );
    return;
  }

  const { url: dlink, filename, size } = tbResult;
  const sizeStr  = size ? formatBytes(size) : '?';
  const safeName = (filename || movieTitle || 'movie').replace(/[^\w\s.\-]/g, '').replace(/\s+/g, '_').slice(0, 60);
  const ext      = (safeName.match(/\.(mp4|mkv|avi|webm)$/i)?.[1] || 'mp4').toLowerCase();
  const fileName = safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;

  await edit(
    `📤 *Sending movie...*\n\n` +
    `🎬 *${movieTitle || filename || 'Movie'}*\n` +
    `📦 *Size:* ${sizeStr}\n\n` +
    `_WhatsApp is downloading the file now..._`
  );

  // Strategy 1: fastDocument — WhatsApp downloads from the dlink directly (fastest)
  try {
    await sock.sendMessage(chatId, {
      document: { url: dlink },
      fileName,
      mimetype: 'video/mp4',
      caption:
        `🎬 *${movieTitle || filename || 'Movie'}*\n` +
        `📦 *Size:* ${sizeStr}\n` +
        `🖥️ *Source:* TeraBox\n\n` +
        `> ♾️ _Infinity MD Mini_`,
    }, { quoted: msg });

    await delStatus();
    await react(sock, msg, '✅');
    return;
  } catch (fastErr) {
    console.warn('[film3tb] fastDocument failed, trying local stream:', fastErr.message);
  }

  // Strategy 2: stream-download locally then send as buffer
  await edit(
    `⬇️ *Downloading from TeraBox...*\n\n` +
    `🎬 *${movieTitle || filename || 'Movie'}*\n` +
    `📦 *Size:* ${sizeStr}\n\n` +
    `_Streaming to bot... please wait_`
  );

  const tmpFile = path.join(os.tmpdir(), `film3tb_${Date.now()}.${ext}`);

  try {
    const response = await axios({
      method: 'GET',
      url: dlink,
      responseType: 'stream',
      timeout: 10 * 60 * 1000,
      maxRedirects: 15,
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': 'https://www.terabox.com/',
      },
    });

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmpFile);
      response.data.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      response.data.on('error', reject);
    });

    const buffer = fs.readFileSync(tmpFile);

    await edit(`📤 *Sending file...*\n\n🎬 *${movieTitle || filename || 'Movie'}*\n📦 *Size:* ${formatBytes(buffer.length)}\n\n_Almost done..._`);

    await sock.sendMessage(chatId, {
      document: buffer,
      fileName,
      mimetype: 'video/mp4',
      caption:
        `🎬 *${movieTitle || filename || 'Movie'}*\n` +
        `📦 *Size:* ${formatBytes(buffer.length)}\n` +
        `🖥️ *Source:* TeraBox\n\n` +
        `> ♾️ _Infinity MD Mini_`,
    }, { quoted: msg });

    await delStatus();
    await react(sock, msg, '✅');
  } catch (err) {
    console.error('[film3tb] stream download error:', err.message);
    await edit(
      `⚠️ *Download failed.*\n\n` +
      `🎬 *${movieTitle || 'Movie'}*\n\n` +
      `🔗 *Download manually:*\n${dlink}\n\n` +
      `> 💡 _Paste the link in your browser_\n> 🎬 _Infinity MD Mini_`
    );
    await react(sock, msg, '❌');
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

module.exports = {
  name: 'film3',
  aliases: ['sinhalasub', 'film3sel', 'film3select', 'film3dl', 'film3tb'],
  category: 'media',
  description: 'Search SinhalaSub.lk for movies | Fast TeraBox download with film3tb',
  usage: 'film3 <movie name>  |  film3tb <terabox share URL>',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId  = extra?.from || msg?.key?.remoteJid;
    const prefix  = extra?.prefix || '.';
    const cmdName = String(extra?.commandName || '').toLowerCase().replace(prefix, '');

    // ── film3tb: Fast TeraBox direct download ────────────────────────────────
    if (cmdName === 'film3tb') {
      const shareUrl = args[0] || '';
      if (!shareUrl || !isTeraBoxUrl(shareUrl)) {
        return sock.sendMessage(chatId, {
          text:
            `🎬 *Fast TeraBox Movie Download*\n\n` +
            `Usage: \`${prefix}film3tb <terabox share URL>\`\n` +
            `Example: \`${prefix}film3tb https://www.terabox.com/s/1xxxxxxx\`\n\n` +
            `_Resolves the TeraBox link and sends the file directly to chat — usually under 1 minute._`,
        }, { quoted: msg });
      }

      await react(sock, msg, '🎬');
      return sendTeraBoxFast(sock, chatId, msg, shareUrl, args.slice(1).join(' ') || null);
    }

    // ── Step 3: film3dl — Download selected quality ───────────────────────────
    if (cmdName === 'film3dl') {
      const idx     = parseInt(args[0], 10);
      const session = detailSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const entry = session[idx];
      await react(sock, msg, '⬇️');

      // Fast path: if this is a pre-resolved TeraBox dlink, send directly
      if (entry.resolvedDlink) {
        return sendTeraBoxFast(sock, chatId, msg, entry.originalTbUrl || entry.url, entry.movieTitle);
      }

      return downloadAndSend(sock, chatId, msg, {
        title: entry.movieTitle,
        quality: `${entry.label}${entry.size ? ` — ${entry.size}` : ''}`,
        downloadUrl: entry.url,
        fastDocument: isTeraBoxUrl(entry.url),
      });
    }

    // ── Step 2: film3sel — Show movie details & quality list ─────────────────
    if (cmdName === 'film3sel' || cmdName === 'film3select') {
      const idx     = parseInt(args[0], 10);
      const session = searchSessions.get(chatId);
      if (!session || isNaN(idx) || !session[idx]) {
        return sock.sendMessage(chatId, {
          text: `⏱️ Session expired.\n\nSearch again with \`${prefix}film3 <movie name>\`.`,
        }, { quoted: msg });
      }

      const movie = session[idx];
      await react(sock, msg, '🔍');

      let details;
      try {
        details = await getMovieDetails(movie.url);
      } catch (err) {
        await react(sock, msg, '❌');
        return sock.sendMessage(chatId, {
          text: `❌ Couldn't load the movie page.\n\n🔗 Open directly:\n${movie.url}\n\n> 🎬 _Infinity MD Mini_`,
        }, { quoted: msg });
      }

      if (!details.qualities.length) {
        await react(sock, msg, '✅');
        return sendBtn(sock, chatId, {
          text:
            `🎬 *${details.title}*\n\n❌ No download links found.\n\n🔗 Visit directly:\n${movie.url}\n\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`,
          footer: '♾️ Infinity MD Mini • SinhalaSub.lk',
          buttons: [
            urlBtn('🌐 Movie Page', movie.url),
            btn('film3', '🔍 New Search'),
          ],
        }, { quoted: msg });
      }

      // Pre-resolve TeraBox links for speed & show real size
      const dlSession = [];
      for (const q of details.qualities.slice(0, 5)) {
        const entry = {
          label: q.label,
          url: q.url,
          size: q.size,
          movieTitle: details.title,
          resolvedDlink: null,
          originalTbUrl: null,
        };

        if (isTeraBoxUrl(q.url)) {
          try {
            const tb = await resolveTeraBox(q.url);
            if (tb?.url) {
              entry.resolvedDlink = tb.url;
              entry.originalTbUrl = q.url;
              if (tb.size) entry.size = formatBytes(tb.size);
              if (tb.filename) entry.label = `⚡ TeraBox — ${tb.filename.slice(0, 30)}`;
              else entry.label = `⚡ TeraBox — Fast`;
            }
          } catch (_) {}
        }

        dlSession.push(entry);
      }

      setTTL(detailSessions, chatId, dlSession);

      let text = `╔══════════════════════╗\n`;
      text += `║ 🎬 *${details.title.slice(0, 28)}*\n`;
      text += `╚══════════════════════╝\n`;
      if (details.year)     text += `│ 📅 *Year:* ${details.year}\n`;
      if (details.language) text += `│ 🗣️ *Language:* ${details.language}\n`;
      if (details.genre)    text += `│ 🎭 *Genre:* ${details.genre}\n`;
      if (details.description) {
        const d = details.description.length > 200
          ? details.description.slice(0, 197) + '…'
          : details.description;
        text += `│\n│ 📖 *Story:*\n│ ${d}\n`;
      }
      text += `\n📥 *Choose download quality:*\n\n`;
      dlSession.forEach((q, i) => {
        const tag = q.resolvedDlink ? ' ⚡' : '';
        text += `│ *${i + 1}.* ${q.label}${q.size ? ` — ${q.size}` : ''}${tag}\n`;
      });
      text += `\n> ⚡ _TeraBox links send in ~1 minute_\n> 🎬 _Infinity MD Mini_`;

      const dlBtns = dlSession.map((q, i) =>
        btn(`film3dl_${i}`, `${q.resolvedDlink ? '⚡' : '⬇️'} ${q.label.slice(0, 20)}`)
      );
      dlBtns.push(btn('film3', '🔍 New Search'));

      const payload = { text, footer: '♾️ Infinity MD Mini • SinhalaSub.lk', buttons: dlBtns };
      if (details.thumbnail) payload.image = { url: details.thumbnail };
      return sendBtn(sock, chatId, payload, { quoted: msg });
    }

    // ── Step 1: Search SinhalaSub.lk ─────────────────────────────────────────
    if (!args.length) {
      return sock.sendMessage(chatId, {
        text:
          `🎬 *SinhalaSub.lk Film Search*\n\n` +
          `• Search: \`${prefix}film3 <movie name>\`\n` +
          `• TeraBox fast DL: \`${prefix}film3tb <terabox URL>\`\n\n` +
          `_Example: \`${prefix}film3 Avengers\`_\n` +
          `_Example: \`${prefix}film3tb https://www.terabox.com/s/1xxx\`_`,
      }, { quoted: msg });
    }

    // If the first arg looks like a TeraBox URL, auto-route to fast download
    if (isTeraBoxUrl(args[0])) {
      await react(sock, msg, '🎬');
      return sendTeraBoxFast(sock, chatId, msg, args[0], args.slice(1).join(' ') || null);
    }

    const query = args.join(' ');
    await react(sock, msg, '🔍');

    const waitMsg = await sock.sendMessage(chatId, {
      text: `🔍 _Searching SinhalaSub.lk for *"${query}"*..._`,
    }, { quoted: msg });
    const delWait = async () => {
      try { await sock.sendMessage(chatId, { delete: waitMsg.key }); } catch (_) {}
    };

    let results;
    try {
      results = await searchMovies(query);
    } catch (err) {
      console.error('[film3] search error:', err.message);
      await delWait();
      await react(sock, msg, '❌');
      if (err.cfBlocked) {
        return sock.sendMessage(chatId, {
          text:
            `🛡️ *SinhalaSub.lk is currently blocking automated requests (Cloudflare).*\n\n` +
            `Try these alternatives:\n` +
            `• \`${prefix}film ${query}\` — searches Cinesubz.net\n` +
            `• \`${prefix}film1 ${query}\` — searches SriHub.store\n` +
            `• \`${prefix}film3tb <terabox URL>\` — if you have a TeraBox share link\n\n` +
            `> 🎬 _Infinity MD Mini_`,
        }, { quoted: msg });
      }
      return sock.sendMessage(chatId, {
        text: `❌ Search failed. Please try again in a moment.\n\n_Try \`${prefix}film ${query}\` as an alternative._`,
      }, { quoted: msg });
    }

    await delWait();

    if (!results.length) {
      await react(sock, msg, '❌');
      return sock.sendMessage(chatId, {
        text: `😔 No results found for *"${query}"* on SinhalaSub.lk.\n\nTry a shorter or different keyword.`,
      }, { quoted: msg });
    }

    await react(sock, msg, '✅');
    setTTL(searchSessions, chatId, results);

    let text = `╔══════════════════════╗\n`;
    text += `║ 🎬 *SinhalaSub Results*\n`;
    text += `╚══════════════════════╝\n\n`;
    text += `🔍 _"${query}"_ — ${results.length} found\n\n`;
    results.forEach((m, i) => {
      text += `│ *${i + 1}.* ${m.title}`;
      if (m.quality) text += ` [${m.quality}]`;
      if (m.year)    text += ` (${m.year})`;
      text += `\n`;
    });
    text += `\n> 💡 _Tap a button to see download options_\n> 🎬 _Infinity MD Mini • SinhalaSub.lk_`;

    const pickBtns = results.map((m, i) =>
      btn(`film3sel_${i}`, `${i + 1}. ${m.title.slice(0, 22)}`)
    );

    const thumb   = results.find(m => m.thumbnail)?.thumbnail;
    const payload = { text, footer: '♾️ Infinity MD Mini • SinhalaSub.lk', buttons: pickBtns };
    if (thumb) payload.image = { url: thumb };
    return sendBtn(sock, chatId, payload, { quoted: msg });
  },
};
