module.exports = {
  name: 'hex',
  aliases: ['tohex', 'fromhex', 'hexcode'],
  category: 'utility',
  description: 'Convert text to hex or hex to text',
  usage: '.hex encode <text> | .hex decode <hex>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage:\n.hex encode <text>\n.hex decode <hex string>\n\nExample:\n.hex encode Hello\n.hex decode 48656c6c6f');
      }

      const action = args[0].toLowerCase();
      const text = args.slice(1).join(' ');

      let result;
      let label;

      if (action === 'encode' || action === 'enc' || action === 'e') {
        result = Buffer.from(text, 'utf-8').toString('hex');
        label = 'TEXT → HEX';
      } else if (action === 'decode' || action === 'dec' || action === 'd') {
        const cleaned = text.replace(/\s+/g, '');
        result = Buffer.from(cleaned, 'hex').toString('utf-8');
        label = 'HEX → TEXT';
      } else {
        return extra.reply('❌ Use "encode" or "decode" as the first argument.');
      }

      const reply = `╭━━〔 🔢 ${label} 〕━━⬣
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
