module.exports = {
  name: 'binary',
  aliases: ['bin', 'tobin', 'frombin'],
  category: 'utility',
  description: 'Convert text to binary or binary to text',
  usage: '.binary encode <text> | .binary decode <binary>',

  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage:\n.binary encode <text>\n.binary decode <binary>\n\nExample:\n.binary encode Hello\n.binary decode 01001000 01100101');
      }

      const action = args[0].toLowerCase();
      const text = args.slice(1).join(' ');

      let result;
      let label;

      if (action === 'encode' || action === 'enc' || action === 'e') {
        result = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        label = 'TEXT → BINARY';
      } else if (action === 'decode' || action === 'dec' || action === 'd') {
        const cleaned = text.replace(/[^01]/g, ' ').trim().split(/\s+/);
        result = cleaned.map(b => String.fromCharCode(parseInt(b, 2))).join('');
        label = 'BINARY → TEXT';
      } else {
        return extra.reply('❌ Use "encode" or "decode" as the first argument.');
      }

      const reply = `╭━━〔 💻 ${label} 〕━━⬣
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
