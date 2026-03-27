module.exports = {
  name: 'pickup',
  aliases: ['pickupline', 'rizz'],
  category: 'fun',
  description: 'Get a random pickup line',
  usage: '.pickup',

  async execute(sock, msg, args, extra) {
    try {
      const lines = [
        "Are you a magician? Because whenever I look at you, everyone else disappears.",
        "Do you have a map? Because I just got lost in your eyes.",
        "Are you a campfire? Because you're hot and I want s'more.",
        "Is your name Google? Because you have everything I've been searching for.",
        "Do you believe in love at first sight, or should I walk by again?",
        "Are you a parking ticket? Because you've got 'fine' written all over you.",
        "If you were a vegetable, you'd be a cute-cumber.",
        "Are you Wi-Fi? Because I'm feeling a connection.",
        "Do you have a Band-Aid? Because I just scraped my knee falling for you.",
        "Is your dad a boxer? Because you're a knockout!",
        "Are you a bank loan? Because you've got my interest.",
        "If beauty were time, you'd be an eternity.",
        "Are you a dictionary? Because you add meaning to my life.",
        "Do you have a sunburn, or are you always this hot?",
        "Are you an alien? Because you just abducted my heart.",
        "Is there an airport nearby, or is that just my heart taking off?",
        "You must be tired because you've been running through my mind all day.",
        "Are you a 90-degree angle? Because you look just right.",
        "If you were a fruit, you'd be a fineapple.",
        "Are you a charger? Because I'd die without you."
      ];

      const line = lines[Math.floor(Math.random() * lines.length)];

      await extra.react('😏');

      const text = `╭━━〔 💘 PICKUP LINE 〕━━⬣
┃
┃ 😏 ${line}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
