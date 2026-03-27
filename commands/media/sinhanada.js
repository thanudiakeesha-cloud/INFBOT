/**
 * Sinhanada Search & Send - Srihub API
 */

const axios = require('axios');

module.exports = {
  name: 'sinhanada',
  aliases: ['snd', 'sndsearch'],
  category: 'media',
  description: 'Search Sinhanada and send song',
  usage: '.sinhanada <song name>',

  async execute(sock, msg, args, extra) {
    const { from, sender, reply, react } = extra;

    const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

    try {
      const store = require('../../lib/lightweight_store');
      const database = require('../../database');
      
      const globalSettings = await database.getGlobalSettings();
      const sessionSettings = sock._customConfig?.settings || {};
      const mode = sessionSettings.srcMode || globalSettings.srcMode || 'private';
      
      if (mode === 'disabled') return reply("❌ SRC commands are currently disabled.");
      
      const isPublic = mode === 'public' || mode === 'public_no_pin';
      const noPin = mode === 'private_no_pin' || mode === 'public_no_pin';

      const sessionKey = `srcimg_pass_${from}_${sender}`;
      let session = await store.getSetting('sessions', sessionKey);
      
      // If no session or not authed, check if it's the global owner
      if (!noPin && (!session || !session.authed)) {
          const isOwner = extra.isOwner;
          if (isOwner) {
              // Auto-auth the owner
              await store.saveSetting('sessions', sessionKey, {
                  authed: true,
                  timestamp: Date.now()
              });
              session = { authed: true };
          }
          
          if (!session || !session.authed) {
              if (isPublic) {
                  return reply("🔑 This feature is Public but requires a PIN unlock once. Use .src 0000");
              }
              return reply("🔑 Private feature. Login first using .src 0000");
          }
      }

      const query = args.join(" ").trim();
      if (!query) return reply("❌ Give song name.");

      await react("⏳");

      // SEARCH API
      const searchUrl = `https://api.srihub.store/search/sinhanada?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;
      const { data } = await axios.get(searchUrl, { timeout: 30000 });

      if (!data.success || !data.result || data.result.length === 0) {
        await react("❌");
        return reply("❌ No songs found.");
      }

      const songResult = data.result[0]; // first result
      const songPage = songResult.link;

      // Download URL fetching
      const downloadUrl = `https://api.srihub.store/download/sinhanada?url=${encodeURIComponent(songPage)}&apikey=${API_KEY}`;
      const { data: dlData } = await axios.get(downloadUrl, { timeout: 30000 });

      if (!dlData.success || !dlData.result) {
        await react("❌");
        return reply("❌ Failed to download song.");
      }

      const song = dlData.result;
      const download_url = song.download_url || song.url || song.link;

      if (!download_url) {
        await react("❌");
        return reply("❌ Could not find a valid download link.");
      }

      await sock.sendMessage(from, {
        audio: { url: download_url },
        mimetype: 'audio/mpeg',
        ptt: false,
        caption: `🎵 *${song.title || song.name || 'Unknown'}*
👤 Artist: ${song.artist || 'Unknown'}
💾 Size: ${song.size || 'Unknown'}
📅 Uploaded: ${song.uploaded_on || 'Unknown'}

> INFINITY MD`
      }, { quoted: msg });

      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ API Error. Check console.");
    }
  }
};
