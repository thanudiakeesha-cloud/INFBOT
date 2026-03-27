module.exports = {
  name: 'flip',
  aliases: ['fliptext', 'upsidedown', 'upside'],
  category: 'utility',
  description: 'Flip text upside down',
  usage: '.flip <text>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .flip <text>\n\nExample: .flip Hello World');
      }

      const text = args.join(' ');

      const flipMap = {
        'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ',
        'g': 'ƃ', 'h': 'ɥ', 'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'l',
        'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd', 'q': 'b', 'r': 'ɹ',
        's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x',
        'y': 'ʎ', 'z': 'z',
        'A': '∀', 'B': 'q', 'C': 'Ɔ', 'D': 'p', 'E': 'Ǝ', 'F': 'Ⅎ',
        'G': 'פ', 'H': 'H', 'I': 'I', 'J': 'ſ', 'K': 'ʞ', 'L': '˥',
        'M': 'W', 'N': 'N', 'O': 'O', 'P': 'Ԁ', 'Q': 'Q', 'R': 'ɹ',
        'S': 'S', 'T': '┴', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X',
        'Y': '⅄', 'Z': 'Z',
        '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ',
        '6': '9', '7': 'ㄥ', '8': '8', '9': '6', '0': '0',
        '.': '˙', ',': '\'', '\'': ',', '"': ',,', '`': ',',
        '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[',
        '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾',
        ' ': ' '
      };

      const flipped = text.split('').map(c => flipMap[c] || c).reverse().join('');

      const reply = `╭━━〔 🙃 FLIPPED TEXT 〕━━⬣
┃ 📥 *Original:* ${text}
┃ 📤 *Flipped:* ${flipped}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
