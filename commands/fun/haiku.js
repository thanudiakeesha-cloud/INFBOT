module.exports = {
  name: 'haiku',
  aliases: ['poem3'],
  category: 'fun',
  description: 'Get a random haiku poem',
  usage: '.haiku',
  async execute(sock, msg, args, extra) {
    const haikus = [
      ['An old silent pond...', 'A frog jumps into the pond.', 'Splash! Silence again.'],
      ['Over the wintry', 'forest, winds howl in rage', 'with no leaves to blow.'],
      ['In the twilight rain', 'these brilliant-hued hibiscus', 'a lovely sunset.'],
      ['A world of dew, and', 'within every dewdrop a', 'world of struggle.'],
      ['Autumn moonlight—', 'a worm digs silently', 'into the chestnut.'],
      ['Lightning flash—', 'what I thought were faces', 'are plumes of pampas grass.'],
      ['From time to time', 'The clouds give rest', 'To the moon-beholders.'],
      ['The first cold shower;', 'even the monkey seems to want', 'a little coat of straw.'],
      ['No sky at all;', 'no earth at all—and still', 'the snowflakes fall.'],
      ['In the moonlight,', 'flowers seem like ghosts', 'dancing in the wind.'],
    ];
    const h = haikus[Math.floor(Math.random() * haikus.length)];
    await extra.reply(`📜 *Random Haiku*\n\n_${h[0]}_\n_${h[1]}_\n_${h[2]}_\n\n> 🌸 *Infinity MD*`);
  }
};
