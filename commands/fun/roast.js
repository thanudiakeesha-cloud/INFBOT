module.exports = {
  name: 'roast',
  aliases: ['burn', 'roastme'],
  category: 'fun',
  description: 'Get a random roast',
  usage: '.roast [@mention]',

  async execute(sock, msg, args, extra) {
    try {
      const roasts = [
        "You're like a cloud. When you disappear, it's a beautiful day.",
        "I'd explain it to you, but I left my crayons at home.",
        "You bring everyone so much joy... when you leave.",
        "You're not stupid; you just have bad luck thinking.",
        "If you were any more inbred, you'd be a sandwich.",
        "I'd agree with you, but then we'd both be wrong.",
        "You're the reason God created the middle finger.",
        "Your secrets are always safe with me. I never even listen when you tell me them.",
        "You're like a software update. Whenever I see you, I think 'not now.'",
        "I'm jealous of people who don't know you.",
        "You're proof that even evolution makes mistakes.",
        "If I had a face like yours, I'd sue my parents.",
        "You're so boring, you can't even start a conversation in an empty room.",
        "Somewhere out there, a tree is producing oxygen for you. I think you owe it an apology.",
        "You're like a penny on the floor. Not worth picking up.",
        "I've been called worse things by better people.",
        "Your face makes onions cry.",
        "I'd challenge you to a battle of wits, but I see you're unarmed.",
        "You're the human equivalent of a participation award.",
        "If brains were dynamite, you wouldn't have enough to blow your nose."
      ];

      const roast = roasts[Math.floor(Math.random() * roasts.length)];
      let target = 'you';
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = `@${msg.message.extendedTextMessage.contextInfo.mentionedJid[0].split('@')[0]}`;
      }

      await extra.react('🔥');

      const text = `╭━━〔 🔥 ROAST 〕━━⬣
┃
┃ 🎯 *Target:* ${target}
┃
┃ 💀 ${roast}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
