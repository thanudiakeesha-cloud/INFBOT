const axios = require('axios');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

const TIKWM_BASE = 'https://tikwm.com';

// Store pending search results per sender (expires after 5 minutes)
const pendingSearches = new Map();
const PENDING_TTL = 5 * 60 * 1000;

function storePending(senderJid, videos) {
  pendingSearches.set(senderJid, { videos, ts: Date.now() });
}

function getPending(senderJid) {
  const entry = pendingSearches.get(senderJid);
  if (!entry) return null;
  if (Date.now() - entry.ts > PENDING_TTL) {
    pendingSearches.delete(senderJid);
    return null;
  }
  return entry.videos;
}

async function searchTikTok(query) {
  const params = new URLSearchParams();
  params.append('keywords', query);
  params.append('count', '5');
  params.append('cursor', '0');
  params.append('HD', '1');
  params.append('web', '1');

  const { data } = await axios.post(
    `${TIKWM_BASE}/api/feed/search`,
    params,
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tikwm.com/',
        'Origin': 'https://tikwm.com'
      }
    }
  );
  return data;
}

async function downloadTikTokByUrl(url) {
  const params = new URLSearchParams();
  params.append('url', url);
  params.append('hd', '1');

  const { data } = await axios.post(
    `${TIKWM_BASE}/api/`,
    params,
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tikwm.com/',
        'Origin': 'https://tikwm.com'
      }
    }
  );
  return data;
}

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttsearch'],
  category: 'media',
  description: 'Search TikTok and send video',
  usage: '.tiktok <search query or TikTok URL>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;
    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      // Handle selection: .tiktok pick <index>
      if (args[0] === 'pick') {
        const index = parseInt(args[1], 10);
        const videos = getPending(sender);
        if (!videos || isNaN(index) || index < 0 || index >= videos.length) {
          return reply('❌ Selection expired or invalid. Please search again with .tiktok <query>');
        }
        const video = videos[index];
        const videoUrl = video.play?.startsWith('http') ? video.play : `${TIKWM_BASE}${video.play}`;
        const title = (video.title || 'TikTok Video').substring(0, 100);
        const author = video.music_info?.author || video.author?.nickname || 'Unknown';
        const duration = video.duration ? `${video.duration}s` : '';

        await react('⏳');
        await sock.sendMessage(from, {
          video: { url: videoUrl },
          caption:
            `🎬 *${title}*\n` +
            `👤 ${author}${duration ? `  ⏱️ ${duration}` : ''}\n\n` +
            `> *INFINITY MD*`
        }, { quoted: msg });
        await react('✅');
        return;
      }

      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search term or TikTok URL.\nUsage: .tiktok <search query>');

      await react('⏳');

      // If a direct TikTok URL is given, download it directly
      if (query.includes('tiktok.com') || query.includes('vt.tiktok')) {
        const data = await downloadTikTokByUrl(query);
        if (data.code === 0 && data.data) {
          const v = data.data;
          const videoUrl = v.hdplay || v.play;
          const resolvedUrl = videoUrl?.startsWith('http') ? videoUrl : `${TIKWM_BASE}${videoUrl}`;
          const title = (v.title || 'TikTok Video').substring(0, 100);
          const author = v.author?.nickname || 'Unknown';
          const duration = v.duration ? `${v.duration}s` : '';

          await sock.sendMessage(from, {
            video: { url: resolvedUrl },
            caption:
              `🎬 *${title}*\n` +
              `👤 ${author}${duration ? `  ⏱️ ${duration}` : ''}\n\n` +
              `> *INFINITY MD*`
          }, { quoted: msg });
          await react('✅');
          return;
        }
        await react('❌');
        return reply('❌ Failed to download TikTok video. Please try again later.');
      }

      // Search flow
      const data = await searchTikTok(query);

      if (data.code !== 0 || !data.data?.videos?.length) {
        await react('❌');
        return reply('❌ No TikTok videos found for that search.');
      }

      const videos = data.data.videos.slice(0, 5);
      storePending(sender, videos);

      const buttons = videos.map((v, i) => {
        const label = (v.title || `Video ${i + 1}`).substring(0, 50);
        return btn(`tiktok_pick_${i}`, `${i + 1}. ${label}`);
      });

      await react('✅');

      await sendBtn(sock, from, {
        title: '🎵 TikTok Search Results',
        text:
          `🔍 *Query:* ${query}\n` +
          `📊 Found *${videos.length}* videos\n\n` +
          `👇 Tap a title to download it:`,
        footer: `♾️ Infinity MD • Results expire in 5 min`,
        buttons,
      }, { quoted: msg });

    } catch (err) {
      console.error('TikTok error:', err.message);
      await react('❌');
      reply('❌ Failed to fetch TikTok video. Please try again later.');
    }
  }
};
