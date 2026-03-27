module.exports = {
  name: 'iq',
  aliases: ['iqtest', 'smarttest'],
  category: 'fun',
  description: 'Check your IQ (random for fun)',
  usage: '.iq [@mention]',

  async execute(sock, msg, args, extra) {
    try {
      const iq = Math.floor(Math.random() * 156) + 45;
      let target = 'You';
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = `@${msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0]}`;
      }

      let emoji = '';
      let level = '';
      if (iq < 70) { emoji = '🤪'; level = 'Below Average'; }
      else if (iq < 90) { emoji = '😅'; level = 'Low Average'; }
      else if (iq < 110) { emoji = '🙂'; level = 'Average'; }
      else if (iq < 130) { emoji = '🧠'; level = 'Above Average'; }
      else if (iq < 150) { emoji = '🎓'; level = 'Gifted'; }
      else { emoji = '🔬'; level = 'Genius'; }

      await extra.react('🧠');

      const text = `╭━━〔 🧠 IQ TEST 〕━━⬣
┃
┃ 🎯 *Target:* ${target}
┃
┃ ${emoji} *IQ Score:* ${iq}
┃ 📊 *Level:* ${level}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
