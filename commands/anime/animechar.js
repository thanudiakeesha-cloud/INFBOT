const characters = [
  { name: "Naruto Uzumaki", anime: "Naruto", description: "The Seventh Hokage of the Hidden Leaf Village. Known for his determination and never-give-up attitude.", abilities: "Shadow Clone Jutsu, Rasengan, Sage Mode, Nine-Tails Chakra Mode", rank: "Hokage" },
  { name: "Goku", anime: "Dragon Ball", description: "A Saiyan warrior raised on Earth. Earth's greatest defender against powerful threats.", abilities: "Kamehameha, Instant Transmission, Ultra Instinct, Spirit Bomb", rank: "Saiyan Warrior" },
  { name: "Monkey D. Luffy", anime: "One Piece", description: "Captain of the Straw Hat Pirates, aiming to become King of the Pirates.", abilities: "Gum-Gum Fruit Powers, Gear Second/Third/Fourth/Fifth, Haki", rank: "Pirate Captain" },
  { name: "Levi Ackerman", anime: "Attack on Titan", description: "Known as humanity's strongest soldier in the Survey Corps.", abilities: "Exceptional ODM Gear skills, Superhuman strength and speed", rank: "Captain" },
  { name: "Itachi Uchiha", anime: "Naruto", description: "A prodigy of the Uchiha clan who sacrificed everything for his village.", abilities: "Sharingan, Mangekyo Sharingan, Tsukuyomi, Amaterasu, Susanoo", rank: "S-Rank Missing-nin" },
  { name: "Roronoa Zoro", anime: "One Piece", description: "Swordsman of the Straw Hat Pirates, aims to become the world's greatest swordsman.", abilities: "Three Sword Style, Haki, Asura", rank: "Pirate / Swordsman" },
  { name: "Light Yagami", anime: "Death Note", description: "A genius high school student who finds the Death Note and becomes Kira.", abilities: "Genius intellect, Death Note", rank: "Student / Kira" },
  { name: "Saitama", anime: "One Punch Man", description: "A hero who can defeat any opponent with a single punch, leading to existential boredom.", abilities: "Immeasurable strength, speed, and durability", rank: "B-Class Hero (S-Class level)" },
  { name: "Eren Yeager", anime: "Attack on Titan", description: "A young man driven by his desire to free humanity from the Titans.", abilities: "Attack Titan, Founding Titan, War Hammer Titan", rank: "Scout Regiment Member" },
  { name: "Vegeta", anime: "Dragon Ball", description: "Prince of the fallen Saiyan race. Initially an antagonist, later becomes an ally.", abilities: "Final Flash, Galick Gun, Ultra Ego, Super Saiyan forms", rank: "Saiyan Prince" },
  { name: "Killua Zoldyck", anime: "Hunter x Hunter", description: "Heir to the Zoldyck family of assassins who befriends Gon.", abilities: "Godspeed, Lightning Palm, Rhythm Echo, Nen", rank: "Hunter / Assassin" },
  { name: "Mikasa Ackerman", anime: "Attack on Titan", description: "One of the strongest soldiers in the Survey Corps, devoted to protecting Eren.", abilities: "Exceptional combat skills, ODM Gear mastery, Ackerman bloodline", rank: "Scout Regiment" },
  { name: "Tanjiro Kamado", anime: "Demon Slayer", description: "A kind-hearted boy who becomes a demon slayer to save his sister Nezuko.", abilities: "Water Breathing, Sun Breathing, Enhanced smell", rank: "Demon Slayer" },
  { name: "Gojo Satoru", anime: "Jujutsu Kaisen", description: "The strongest jujutsu sorcerer alive, teacher at Tokyo Jujutsu High.", abilities: "Infinity, Six Eyes, Unlimited Void, Reversed Cursed Technique", rank: "Special Grade Sorcerer" },
  { name: "Edward Elric", anime: "Fullmetal Alchemist", description: "The youngest State Alchemist, seeking the Philosopher's Stone to restore his brother's body.", abilities: "Alchemy without transmutation circle, Automail arm", rank: "State Alchemist" },
  { name: "Lelouch vi Britannia", anime: "Code Geass", description: "An exiled prince who leads a rebellion against the Holy Britannian Empire.", abilities: "Geass (Power of Absolute Obedience), Strategic genius", rank: "Emperor / Zero" },
  { name: "Spike Spiegel", anime: "Cowboy Bebop", description: "A laid-back bounty hunter aboard the spaceship Bebop.", abilities: "Jeet Kune Do, Expert marksman, Spacecraft piloting", rank: "Bounty Hunter" },
  { name: "Gon Freecss", anime: "Hunter x Hunter", description: "A young boy searching for his father who is a legendary Hunter.", abilities: "Jajanken (Rock, Paper, Scissors), Nen enhancement", rank: "Hunter" },
  { name: "Rem", anime: "Re:Zero", description: "A demon maid who works at Roswaal's mansion, devoted to Subaru.", abilities: "Horn, Water magic, Superhuman strength in demon form", rank: "Maid / Demon" },
  { name: "Zero Two", anime: "Darling in the Franxx", description: "A mysterious girl with klaxosaur blood, known for being a partner killer.", abilities: "FranXX piloting, Superhuman abilities, Klaxosaur powers", rank: "Parasite / Pistil" }
];

module.exports = {
  name: 'animechar',
  aliases: ['animecharacter', 'randomchar'],
  category: 'anime',
  desc: 'Get random anime character info',
  usage: 'animechar',
  execute: async (sock, msg, args, extra) => {
    try {
      const char = characters[Math.floor(Math.random() * characters.length)];

      const text = `🎭 *Random Anime Character* 🎭\n\n` +
        `👤 *Name:* ${char.name}\n` +
        `🎬 *Anime:* ${char.anime}\n` +
        `📝 *Description:* ${char.description}\n` +
        `⚔️ *Abilities:* ${char.abilities}\n` +
        `🏅 *Rank:* ${char.rank}`;

      await sock.sendMessage(extra.from, { text }, { quoted: msg });
    } catch (error) {
      console.error('Error in animechar command:', error);
      await extra.reply('❌ Failed to get anime character info. Please try again.');
    }
  }
};
