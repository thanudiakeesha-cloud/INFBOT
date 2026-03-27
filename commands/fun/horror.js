module.exports = {
  name: 'horror',
  aliases: ['scary', 'horrorstory', 'creepy'],
  category: 'fun',
  description: 'Get a random short horror story',
  usage: '.horror',

  async execute(sock, msg, args, extra) {
    try {
      const stories = [
        "I begin tucking him into bed and he tells me, \"Daddy, check for monsters under my bed.\" I look underneath for his amusement and see him, another him, under the bed, staring back at me quivering and whispering, \"Daddy, there's somebody on my bed.\"",
        "The last man on Earth sat alone in a room. There was a knock on the door.",
        "She asked why I was breathing so heavily. I wasn't.",
        "I can't move, breathe, speak or hear and it's so dark all the time. If I knew it would be this lonely, I would have been cremated instead.",
        "Don't be scared of the monsters, just look for them. Look to your left, to your right, under your bed, behind your dresser, in your closet but never look up, she hates being seen.",
        "I woke up to hear knocking on glass. At first, I thought it was the window until I heard it come from the mirror.",
        "They delivered the mannequins in bubble wrap. From the main room, I heard popping.",
        "I always thought my cat had a staring problem — she always seemed fixated on my face. Until one day, when I realized she was staring at something just behind me.",
        "You hear your mom calling you into the kitchen. As you are heading down the stairs you hear a whisper from the closet saying, \"Don't go down there honey, I heard it too.\"",
        "There was a picture in my phone of me sleeping. I live alone.",
        "I just saw my reflection blink.",
        "The doctors told the amputee he might experience a phantom limb from time to time. Nobody prepared him for the phantom hand around his throat during the night.",
        "After working a hard day, I came home to see my girlfriend cradling our child. I didn't know which was more frightening, seeing my dead girlfriend and stillborn child, or knowing that someone broke into my apartment to dig them up.",
        "Growing up with cats and dogs, I got used to the sounds of scratching at my door while I slept. Now that I live alone, it is much more unsettling.",
        "My daughter won't stop crying and screaming in the middle of the night. I visit her grave and ask her to stop, but it never works."
      ];

      const story = stories[Math.floor(Math.random() * stories.length)];

      await extra.react('👻');

      const text = `╭━━〔 👻 HORROR STORY 〕━━⬣
┃
┃ 🕯️ ${story}
┃
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(text);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
