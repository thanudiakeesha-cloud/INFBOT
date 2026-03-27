module.exports = {
  name: 'curseme',
  aliases: ['roastme2', 'rip'],
  category: 'fun',
  description: 'Get a creative curse (just for fun!)',
  usage: '.curseme [@user]',
  async execute(sock, msg, args, extra) {
    const curses = [
      'May your WiFi always disconnect during important calls! 📡',
      'May you always step on LEGO in the dark! 🧱',
      'May your phone battery always die at 1%! 🔋',
      'May your earphones always get tangled! 🎧',
      'May you always bite your tongue while eating! 😬',
      'May your alarm never ring on time! ⏰',
      'May your favorite show always buffer! 📺',
      'May you always open the wrong app in public! 📱',
      'May autocorrect betray you in important messages! ⌨️',
      'May your ice cream always fall from the cone! 🍦',
      'May your shoelaces always untie at the worst moment! 👟',
      'May you always forget your umbrella on rainy days! ☂️',
    ];
    const c = curses[Math.floor(Math.random() * curses.length)];
    await extra.reply(`💀 *The Curse*\n\n_${c}_\n\n😂 (Just for fun!)\n\n> 🔮 *Infinity MD*`);
  }
};
