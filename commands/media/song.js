/**
 * .song — YouTube audio downloader (FAST parallel API race)
 * Fires all download APIs simultaneously and uses whichever responds first.
 */

const axios = require('axios');
const yts   = require('yt-search');

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
};

// ── Individual API callers ────────────────────────────────────────────────────

async function tryIzumiUrl(url) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('Izumi: no download');
}

async function tryIzumiQuery(query) {
  const res = await axios.get(
    `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.result;
  if (d?.download) return { download: d.download, title: d.title, thumbnail: d.thumbnail };
  throw new Error('IzumiQuery: no download');
}

async function tryYupra(url) {
  const res = await axios.get(
    `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  const d = res?.data?.data;
  if (res?.data?.success && d?.download_url) {
    return { download: d.download_url, title: d.title, thumbnail: d.thumbnail };
  }
  throw new Error('Yupra: no download');
}

async function tryOkatsu(url) {
  const res = await axios.get(
    `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (res?.data?.dl) {
    return { download: res.data.dl, title: res.data.title, thumbnail: res.data.thumb };
  }
  throw new Error('Okatsu: no download');
}

async function tryElitePro(url) {
  const res = await axios.get(
    `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
    { headers: HEADERS, timeout: 25000 }
  );
  if (res?.data?.success && res?.data?.downloadURL) {
    return { download: res.data.downloadURL, title: res.data.title, thumbnail: null };
  }
  throw new Error('ElitePro: no download');
}

// ── Race helpers ──────────────────────────────────────────────────────────────

/** Run all promises in parallel; return first one that resolves with a valid result. */
function raceValid(promises) {
  return Promise.any(promises);
}

/** Get audio result by YouTube URL — all APIs race simultaneously. */
async function getAudioByUrl(youtubeUrl) {
  return raceValid([
    tryIzumiUrl(youtubeUrl),
    tryYupra(youtubeUrl),
    tryOkatsu(youtubeUrl),
    tryElitePro(youtubeUrl),
  ]);
}

/** Get audio result by search query — yt-search + Izumi query race, then URL race. */
async function getAudioByQuery(query) {
  // Start yt-search and Izumi query simultaneously
  const [ytsResult, izumiResult] = await Promise.allSettled([
    yts(query).then(r => r.videos?.[0] || null),
    tryIzumiQuery(query),
  ]);

  // If Izumi query succeeded, use it immediately
  if (izumiResult.status === 'fulfilled') {
    return izumiResult.value;
  }

  // Use yt-search result to build URL, then race all URL APIs
  if (ytsResult.status === 'fulfilled' && ytsResult.value) {
    const video = ytsResult.value;
    const result = await getAudioByUrl(video.url);
    // Merge yt-search metadata as fallback
    result.title     = result.title     || video.title;
    result.thumbnail = result.thumbnail || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/sddefault.jpg` : null);
    result.duration  = video.duration?.timestamp || '';
    return result;
  }

  throw new Error('All song APIs failed');
}

// ── Command export ────────────────────────────────────────────────────────────

module.exports = {
  name: 'song',
  aliases: ['music', 'mp3', 'audio'],
  category: 'media',
  description: 'Search YouTube and download as audio/song',
  usage: '.song <song name or YouTube URL>',

  async execute(sock, msg, args, extra) {
    const { reply, react } = extra;
    const chatId = msg.key.remoteJid;

    try {
      const query = args.join(' ').trim();
      if (!query) {
        return reply('❌ Please provide a song name or YouTube link.\n\nUsage: `.song <song name>`');
      }

      await react('⏳');

      const statusMsg = await sock.sendMessage(chatId, {
        text: `🎵 _Searching:_ *${query}*\n_Fetching from fastest source..._`,
      }, { quoted: msg });

      const editStatus = async (text) => {
        try { await sock.sendMessage(chatId, { text, edit: statusMsg.key }); } catch (_) {}
      };

      let result = null;
      const isUrl = YT_REGEX.test(query);

      try {
        result = isUrl ? await getAudioByUrl(query) : await getAudioByQuery(query);
      } catch (e) {
        // If URL failed, try query search as final fallback
        if (isUrl) {
          try { result = await getAudioByQuery(query); } catch (_) {}
        }
      }

      if (!result?.download) {
        await react('❌');
        await editStatus(`❌ Could not find or download *"${query}"*. Please try another name or link.`);
        return;
      }

      const title    = result.title    || query;
      const thumb    = result.thumbnail || null;
      const duration = result.duration  || '';
      const safeTitle = title.replace(/[^\w\s-]/g, '').trim() || 'audio';

      await editStatus(`🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n⬇️ _Sending audio..._`);

      // Send thumbnail + caption if available
      if (thumb) {
        try {
          await sock.sendMessage(chatId, {
            image: { url: thumb },
            caption: `🎵 *${title}*${duration ? `\n⏱️ ${duration}` : ''}\n\n> 💫 *INFINITY MD*`,
          }, { quoted: msg });
        } catch (_) {}
      }

      // Send audio — try direct URL first (fastest), then buffer fallback
      try {
        await sock.sendMessage(chatId, {
          audio: { url: result.download },
          mimetype: 'audio/mpeg',
          fileName: `${safeTitle}.mp3`,
          ptt: false,
        }, { quoted: msg });
        await react('✅');
        // Delete the status message cleanly
        try { await sock.sendMessage(chatId, { delete: statusMsg.key }); } catch (_) {}
      } catch (_) {
        // Buffer fallback
        try {
          const buf = await axios.get(result.download, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: HEADERS,
          }).then(r => Buffer.from(r.data));

          await sock.sendMessage(chatId, {
            audio: buf,
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`,
            ptt: false,
          }, { quoted: msg });
          await react('✅');
          try { await sock.sendMessage(chatId, { delete: statusMsg.key }); } catch (_) {}
        } catch (bufErr) {
          await react('❌');
          await editStatus(`❌ Failed to send audio. Please try again.`);
        }
      }

    } catch (err) {
      console.error('[SONG] Error:', err?.message);
      await react('❌');
      reply('❌ Failed to download song. Please try again later.');
    }
  },
};
