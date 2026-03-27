module.exports = {
  name: 'simp',
  aliases: ['simprate', 'simpmeter'],
  category: 'fun',
  description: 'Check your simp rate',
  usage: '.simp [@mention]',

  async execute(sock, msg, args, extra) {
    try {
      const rate = Math.floor(Math.random() * 101);
      let target = 'You';
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = `@${msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0]}`;
      }

      let emoji = '';
      let comment = '';
      if (rate <= 20) { emoji = '😎'; comment = 'Not a simp at all! Respect.'; }
      else if (rate <= 40) { emoji = '🙂'; comment = 'Barely a simp. You\'re cool.'; }
      else if (rate <= 60) { emoji = '😳'; comment = 'Moderate simp detected!'; }
      else if (rate <= 80) { emoji = '😍'; comment = 'Major simp alert!'; }
      else { emoji = '🥺'; comment = 'ULTIMATE SIMP! No hope left.'; }

      const bar = '█'.repeat(Math.floor(rate / 10)) + '░'.repeat(10 - Math.floor(rate / 10));

      await extra.react('💕');

      const text = `╭━━〔 💕 SIMP METER 〕━━⬣
┃
┃ 🎯 *Target:* ${target}
┃
┃ ${emoji} *Simp Rate:* ${rate}%
┃ [${bar}]
┃
┃ 💬 ${comment}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
