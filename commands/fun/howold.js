module.exports = {
  name: 'howold',
  aliases: ['guessage', 'age'],
  category: 'fun',
  description: 'Guess your age (random for fun)',
  usage: '.howold [@mention]',

  async execute(sock, msg, args, extra) {
    try {
      const age = Math.floor(Math.random() * 70) + 10;
      let target = 'You';
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = `@${msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0]}`;
      }

      let emoji = '';
      let comment = '';
      if (age < 18) { emoji = '👶'; comment = 'Still a baby!'; }
      else if (age < 25) { emoji = '🧑'; comment = 'Young and wild!'; }
      else if (age < 35) { emoji = '💪'; comment = 'In your prime!'; }
      else if (age < 50) { emoji = '👨'; comment = 'Experienced and wise!'; }
      else if (age < 65) { emoji = '🧓'; comment = 'The OG!'; }
      else { emoji = '👴'; comment = 'Living legend!'; }

      await extra.react('🎂');

      const text = `╭━━〔 🎂 HOW OLD ARE YOU 〕━━⬣
┃
┃ 🎯 *Target:* ${target}
┃
┃ ${emoji} *Guessed Age:* ${age} years old
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
