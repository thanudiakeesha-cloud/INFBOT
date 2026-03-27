module.exports = {
  name: 'emojistory',
  aliases: ['emojitale', 'emojiplot'],
  category: 'fun',
  description: 'Get a random story told in emojis',
  usage: '.emojistory',
  async execute(sock, msg, args, extra) {
    const stories = [
      { emojis: '👦➡️🌲🌲🌲😱🐺🏃💨🏠🔒😅', title: 'Little Red Riding Hood vibes' },
      { emojis: '👸🍎😴💤🤴💋👸❤️💍', title: 'Sleeping Beauty' },
      { emojis: '🐟🐠🌊🐟🎣🪣😢💧🌊🏠', title: 'Finding Nemo moments' },
      { emojis: '🧙📚⚡🔮🐍🏰🗡️😈💥✨🏆', title: 'A magical adventure' },
      { emojis: '🚀🌍👨‍🚀⭐🪐👽😱🤝❤️🌍', title: 'Space exploration' },
      { emojis: '💑☕👫🌹💌💍🎂👶🏠❤️', title: 'A love story' },
      { emojis: '🐣🐤🌱🌿🌳🌸🦋☀️🌈🌍', title: 'Circle of life' },
      { emojis: '📚😩🌙☕💡✍️📖🎓🏆😊', title: 'Student life' },
    ];
    const s = stories[Math.floor(Math.random() * stories.length)];
    await extra.reply(`📖 *Emoji Story*\n\n*"${s.title}"*\n\n${s.emojis}\n\n_Can you figure out the full story?_\n\n> 🎭 *Infinity MD*`);
  }
};
