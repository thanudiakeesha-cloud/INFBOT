module.exports = {
  name: 'color',
  aliases: ['randomcolor', 'colour', 'hexcolor'],
  category: 'utility',
  description: 'Generate a random color or get info about a hex color',
  usage: '.color [hex code]',

  async execute(sock, msg, args, extra) {
    try {
      let hex;

      if (args.length > 0) {
        hex = args[0].replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
          return extra.reply('❌ Invalid hex color! Use format: #RRGGBB or RRGGBB\n\nExample: .color FF5733');
        }
      } else {
        hex = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      }

      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const l = ((max + min) / 2 * 100).toFixed(1);
      const s = max === min ? 0 : (l > 50 ? ((max - min) / (2 - max - min)) * 100 : ((max - min) / (max + min)) * 100).toFixed(1);

      let h = 0;
      if (max !== min) {
        const d = max - min;
        const rn = r / 255, gn = g / 255, bn = b / 255;
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        else if (max === gn) h = ((bn - rn) / d + 2) * 60;
        else h = ((rn - gn) / d + 4) * 60;
      }

      const reply = `╭━━〔 🎨 COLOR INFO 〕━━⬣
┃ 🔷 *HEX:* #${hex.toUpperCase()}
┃ 🔴 *RGB:* ${r}, ${g}, ${b}
┃ 🌈 *HSL:* ${Math.round(h)}°, ${s}%, ${l}%
┃ 🎯 *Decimal:* ${parseInt(hex, 16)}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
