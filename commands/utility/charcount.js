module.exports = {
  name: 'charcount',
  aliases: ['cc', 'textinfo', 'textstat'],
  category: 'utility',
  description: 'Detailed character, word, and line count analysis',
  usage: '.charcount <text>',

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
        return extra.reply('❌ Usage: .charcount <text>\nOr reply to a message with .charcount');
      }

      const chars = text.length;
      const charsNoSpaces = text.replace(/\s/g, '').length;
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const lines = text.split('\n').length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

      const vowels = (text.match(/[aeiouAEIOU]/g) || []).length;
      const consonants = (text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
      const digits = (text.match(/[0-9]/g) || []).length;
      const spaces = (text.match(/\s/g) || []).length;
      const special = chars - vowels - consonants - digits - spaces;

      const uppercase = (text.match(/[A-Z]/g) || []).length;
      const lowercase = (text.match(/[a-z]/g) || []).length;

      const uniqueWords = new Set(text.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0)).size;
      const avgWordLen = words > 0 ? (charsNoSpaces / words).toFixed(1) : 0;
      const readingTime = Math.ceil(words / 200);
      const speakingTime = Math.ceil(words / 130);

      const reply = `╭━━〔 📊 DETAILED TEXT ANALYSIS 〕━━⬣
┃ 
┃ 📝 *Basic Counts:*
┃ ├ Characters: ${chars.toLocaleString()}
┃ ├ Characters (no spaces): ${charsNoSpaces.toLocaleString()}
┃ ├ Words: ${words.toLocaleString()}
┃ ├ Unique words: ${uniqueWords.toLocaleString()}
┃ ├ Sentences: ${sentences}
┃ ├ Lines: ${lines}
┃ └ Paragraphs: ${paragraphs}
┃ 
┃ 🔤 *Character Breakdown:*
┃ ├ Vowels: ${vowels}
┃ ├ Consonants: ${consonants}
┃ ├ Digits: ${digits}
┃ ├ Spaces: ${spaces}
┃ ├ Special: ${special}
┃ ├ Uppercase: ${uppercase}
┃ └ Lowercase: ${lowercase}
┃ 
┃ 📏 *Statistics:*
┃ ├ Avg word length: ${avgWordLen} chars
┃ ├ Reading time: ~${readingTime} min
┃ └ Speaking time: ~${speakingTime} min
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
