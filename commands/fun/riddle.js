module.exports = {
  name: 'riddle',
  aliases: ['riddles', 'brainteaser'],
  category: 'fun',
  description: 'Get a random riddle',
  usage: '.riddle',

  async execute(sock, msg, args, extra) {
    try {
      const riddles = [
        { q: "What has keys but no locks?", a: "A piano" },
        { q: "What has hands but can't clap?", a: "A clock" },
        { q: "What has a head and a tail but no body?", a: "A coin" },
        { q: "What gets wetter the more it dries?", a: "A towel" },
        { q: "I speak without a mouth and hear without ears. What am I?", a: "An echo" },
        { q: "What can travel around the world while staying in a corner?", a: "A stamp" },
        { q: "What has cities but no houses, forests but no trees, and water but no fish?", a: "A map" },
        { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
        { q: "What can you break even if you never pick it up or touch it?", a: "A promise" },
        { q: "What goes up but never comes down?", a: "Your age" },
        { q: "I have branches, but no fruit, trunk, or leaves. What am I?", a: "A bank" },
        { q: "What can fill a room but takes up no space?", a: "Light" },
        { q: "What is always in front of you but can't be seen?", a: "The future" },
        { q: "What has legs but doesn't walk?", a: "A table" },
        { q: "What has one eye but can't see?", a: "A needle" },
        { q: "What has words but never speaks?", a: "A book" },
        { q: "What has a neck but no head?", a: "A bottle" },
        { q: "What invention lets you look right through a wall?", a: "A window" },
        { q: "What can you catch but not throw?", a: "A cold" },
        { q: "What building has the most stories?", a: "A library" }
      ];

      const riddle = riddles[Math.floor(Math.random() * riddles.length)];

      await extra.react('🧩');

      const text = `╭━━〔 🧩 RIDDLE 〕━━⬣
┃
┃ ❓ *${riddle.q}*
┃
┃ 💡 Reply ".answer" to reveal!
┃
┃ ||${riddle.a}||
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
