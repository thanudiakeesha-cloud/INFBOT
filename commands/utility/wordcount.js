module.exports = {
  name: 'wordcount',
  aliases: ['wc', 'charcount', 'count'],
  category: 'utility',
  description: 'Count words, characters, and lines in text',
  usage: '.wordcount <text> or reply to a message',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ');

      if (!text) {
        const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
        if (ctxInfo?.quotedMessage) {
          const quoted = ctxInfo.quotedMessage;
          text = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || '';
        }
      }

      if (!text || text.trim().length === 0) {
        return extra.reply('❌ Usage: .wordcount <text>\nOr reply to a message with .wordcount');
      }

      const characters = text.length;
      const charactersNoSpaces = text.replace(/\s/g, '').length;
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const lines = text.split('\n').length;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

      const avgWordLen = words > 0 ? (charactersNoSpaces / words).toFixed(1) : 0;
      const readingTimeMin = Math.ceil(words / 200);

      await extra.react('📊');

      const reply = `╭━━〔 📊 TEXT ANALYSIS 〕━━⬣
┃ 📝 *Characters:* ${characters.toLocaleString()}
┃ 🔤 *Characters (no spaces):* ${charactersNoSpaces.toLocaleString()}
┃ 📖 *Words:* ${words.toLocaleString()}
┃ 📄 *Sentences:* ${sentences}
┃ 📃 *Lines:* ${lines}
┃ 📑 *Paragraphs:* ${paragraphs}
┃ 📏 *Avg word length:* ${avgWordLen} chars
┃ ⏱️ *Reading time:* ~${readingTimeMin} min
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
