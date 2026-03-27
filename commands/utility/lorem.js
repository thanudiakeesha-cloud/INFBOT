module.exports = {
  name: 'lorem',
  aliases: ['loremipsum', 'lipsum'],
  category: 'utility',
  description: 'Generate lorem ipsum placeholder text',
  usage: '.lorem [paragraphs]',

  async execute(sock, msg, args, extra) {
    try {
      let count = parseInt(args[0]) || 1;
      if (count < 1) count = 1;
      if (count > 10) count = 10;

      const sentences = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
        'Nulla facilisi etiam dignissim diam quis enim lobortis scelerisque.',
        'Viverra accumsan in nisl nisi scelerisque eu ultrices vitae auctor.',
        'Eget nulla facilisi etiam dignissim diam quis enim lobortis.',
        'Amet consectetur adipiscing elit pellentesque habitant morbi tristique.',
        'Turpis egestas pretium aenean pharetra magna ac placerat vestibulum.',
        'Pellentesque habitant morbi tristique senectus et netus et malesuada.',
        'Faucibus pulvinar elementum integer enim neque volutpat ac tincidunt.',
        'Consequat mauris nunc congue nisi vitae suscipit tellus mauris.',
        'Cras tincidunt lobortis feugiat vivamus at augue eget arcu.',
        'Neque viverra justo nec ultrices dui sapien eget mi proin.',
      ];

      const paragraphs = [];
      for (let i = 0; i < count; i++) {
        const paraLen = 3 + Math.floor(Math.random() * 4);
        const para = [];
        for (let j = 0; j < paraLen; j++) {
          para.push(sentences[Math.floor(Math.random() * sentences.length)]);
        }
        paragraphs.push(para.join(' '));
      }

      const result = paragraphs.join('\n\n');

      const reply = `╭━━〔 📜 LOREM IPSUM 〕━━⬣
┃ 📄 *Paragraphs:* ${count}
╰━━━━━━━━━━━━━━━━━━━━⬣

${result}

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
