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

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttsearch'],
  category: 'media',
  description: 'Search TikTok and send video',
  usage: '.tiktok <search query>',

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

      // Normal search flow
      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search term.\nUsage: .tiktok <search query>');

      await react('⏳');

      const { data } = await axios.get(
        `${TIKWM_BASE}/api/feed/search?keywords=${encodeURIComponent(query)}&count=5&cursor=0&HD=1&web=1`,
        { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      );

      if (data.code !== 0 || !data.data?.videos?.length) {
        await react('❌');
        return reply('❌ No TikTok videos found for that search.');
      }

      const videos = data.data.videos.slice(0, 5);
      storePending(sender, videos);

      // Build selection buttons (max 5)
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
