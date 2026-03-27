module.exports = {
  name: 'password',
  aliases: ['pass', 'genpass', 'passgen'],
  category: 'utility',
  description: 'Generate a random secure password',
  usage: '.password [length]',

  async execute(sock, msg, args, extra) {
    try {
      let length = parseInt(args[0]) || 16;
      if (length < 4) length = 4;
      if (length > 128) length = 128;

      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const all = uppercase + lowercase + numbers + symbols;

      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += symbols[Math.floor(Math.random() * symbols.length)];

      for (let i = 4; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
      }

      password = password.split('').sort(() => Math.random() - 0.5).join('');

      const strength = length >= 16 ? '🟢 Very Strong' : length >= 12 ? '🟡 Strong' : length >= 8 ? '🟠 Medium' : '🔴 Weak';

      const reply = `╭━━〔 🔐 PASSWORD GENERATOR 〕━━⬣
┃ 🔑 *Password:* \`${password}\`
┃ 📏 *Length:* ${length}
┃ 💪 *Strength:* ${strength}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
