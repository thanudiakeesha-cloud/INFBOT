const axios = require('axios');

module.exports = {
  name: 'manga',
  aliases: ['searchmanga', 'mangasearch'],
  category: 'anime',
  desc: 'Search for manga information',
  usage: 'manga <title>',
  execute: async (sock, msg, args, extra) => {
    try {
      if (!args.length) {
        return await extra.reply('❌ Please provide a manga title.\n\n📖 Usage: manga <title>\nExample: manga One Piece');
      }

      const query = args.join(' ');
      const response = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=1`, {
        timeout: 15000,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        return await extra.reply(`❌ No manga found for: *${query}*`);
      }

      const manga = response.data.data[0];
      const synopsis = manga.synopsis
        ? (manga.synopsis.length > 300 ? manga.synopsis.substring(0, 300) + '...' : manga.synopsis)
        : 'No synopsis available';

      const text = `📚 *Manga Info* 📚\n\n` +
        `📖 *Title:* ${manga.title}\n` +
        `${manga.title_japanese ? `🇯🇵 *Japanese:* ${manga.title_japanese}\n` : ''}` +
        `📊 *Status:* ${manga.status || 'Unknown'}\n` +
        `📕 *Chapters:* ${manga.chapters || 'Ongoing'}\n` +
        `📗 *Volumes:* ${manga.volumes || 'Ongoing'}\n` +
        `⭐ *Score:* ${manga.score || 'N/A'}\n` +
        `🏆 *Rank:* #${manga.rank || 'N/A'}\n` +
        `👥 *Members:* ${manga.members ? manga.members.toLocaleString() : 'N/A'}\n` +
        `📝 *Type:* ${manga.type || 'N/A'}\n` +
        `🏷️ *Genres:* ${manga.genres?.map(g => g.name).join(', ') || 'N/A'}\n\n` +
        `📋 *Synopsis:*\n${synopsis}\n\n` +
        `🔗 *URL:* ${manga.url || 'N/A'}`;

      if (manga.images?.jpg?.large_image_url) {
        try {
          const imgResponse = await axios.get(manga.images.jpg.large_image_url, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          await sock.sendMessage(extra.from, {
            image: Buffer.from(imgResponse.data),
            caption: text
          }, { quoted: msg });
          return;
        } catch (imgErr) {
        }
      }

      await sock.sendMessage(extra.from, { text }, { quoted: msg });
    } catch (error) {
      console.error('Error in manga command:', error);
      if (error.response?.status === 429) {
        await extra.reply('❌ Rate limit exceeded. Please try again in a few seconds.');
      } else {
        await extra.reply('❌ Failed to search manga. Please try again.');
      }
    }
  }
};
