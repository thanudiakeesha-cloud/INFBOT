module.exports = {
  name: 'uuid',
  aliases: ['genuuid', 'guid'],
  category: 'utility',
  description: 'Generate a random UUID',
  usage: '.uuid [count]',

  async execute(sock, msg, args, extra) {
    try {
      let count = parseInt(args[0]) || 1;
      if (count < 1) count = 1;
      if (count > 10) count = 10;

      function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      const uuids = [];
      for (let i = 0; i < count; i++) {
        uuids.push(generateUUID());
      }

      let reply = `╭━━〔 🆔 UUID GENERATOR 〕━━⬣\n`;
      uuids.forEach((uuid, i) => {
        reply += `┃ ${count > 1 ? `${i + 1}. ` : '🔑 '}\`${uuid}\`\n`;
      });
      reply += `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
