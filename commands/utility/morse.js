module.exports = {
  name: 'morse',
  aliases: ['morsecode'],
  category: 'utility',
  description: 'Convert text to morse code or decode morse code',
  usage: '.morse encode <text> | .morse decode <morse>',

  async execute(sock, msg, args, extra) {
    try {
      const morseMap = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
        '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
        '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
        '!': '-.-.--', ' ': '/'
      };

      const reverseMorse = {};
      for (const [k, v] of Object.entries(morseMap)) {
        reverseMorse[v] = k;
      }

      if (args.length < 2) {
        return extra.reply('❌ Usage:\n.morse encode <text>\n.morse decode <morse code>\n\nExample:\n.morse encode Hello\n.morse decode .... . .-.. .-.. ---');
      }

      const action = args[0].toLowerCase();
      const text = args.slice(1).join(' ');

      let result;
      let label;

      if (action === 'encode' || action === 'enc' || action === 'e') {
        result = text.toUpperCase().split('').map(c => morseMap[c] || c).join(' ');
        label = 'TEXT → MORSE';
      } else if (action === 'decode' || action === 'dec' || action === 'd') {
        result = text.split(' ').map(code => {
          if (code === '/') return ' ';
          return reverseMorse[code] || code;
        }).join('');
        label = 'MORSE → TEXT';
      } else {
        return extra.reply('❌ Use "encode" or "decode" as the first argument.');
      }

      const reply = `╭━━〔 📡 ${label} 〕━━⬣
┃ 📥 *Input:* ${text.length > 100 ? text.substring(0, 100) + '...' : text}
┃ 📤 *Output:* ${result.length > 500 ? result.substring(0, 500) + '...' : result}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
