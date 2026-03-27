const fs = require('fs');
const path = require('path');
const axios = require('axios');
const database = require('../../database');

module.exports = {
  name: 'autopp',
  aliases: ['autodp', 'autodpp'],
  category: 'owner',
  description: 'Auto change bot profile picture',
  usage: '.autopp <on/off/now/query>',

  async execute(sock, msg, args, extra) {
    if (!extra.isOwner) return extra.reply('❌ Owner only.');
    
    const sub = args[0]?.toLowerCase();
    const query = args.slice(1).join(' ') || 'whatsapp profile pictures for boys';

    if (sub === 'now') {
      await extra.reply('⏳ Updating profile picture...');
      try {
        const apiKey = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
        const res = await axios.get(`https://api.srihub.store/search/img?q=${encodeURIComponent(query)}&apikey=${apiKey}`);
        const links = res.data?.result || [];
        if (!links.length) throw new Error('No images found');
        
        const pick = links[Math.floor(Math.random() * links.length)];
        const imgRes = await axios.get(pick, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imgRes.data);
        
        const tmpPath = path.join(process.cwd(), 'temp', `autopp_${Date.now()}.jpg`);
        if (!fs.existsSync(path.dirname(tmpPath))) fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
        fs.writeFileSync(tmpPath, buffer);
        
        await sock.updateProfilePicture(sock.user.id, { url: tmpPath });
        fs.unlinkSync(tmpPath);
        
        return extra.reply(`✅ Profile picture updated!\n🖼️ Source: ${pick}`);
      } catch (e) {
        return extra.reply(`❌ Failed: ${e.message}`);
      }
    }
    
    extra.reply('👤 *AUTO PP*\n\nUsage:\n.autopp now\n.autopp query <text>');
  }
};
