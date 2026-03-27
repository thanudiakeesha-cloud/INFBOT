module.exports = {
  name: 'json',
  aliases: ['formatjson', 'beautify', 'prettyjson'],
  category: 'utility',
  description: 'Format and beautify JSON text',
  usage: '.json <json string>',

  async execute(sock, msg, args, extra) {
    try {
      let text = args.join(' ');

      if (!text) {
        const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
        if (ctxInfo?.quotedMessage) {
          const quoted = ctxInfo.quotedMessage;
          text = quoted.conversation || quoted.extendedTextMessage?.text || '';
        }
      }

      if (!text || text.trim().length === 0) {
        return extra.reply('❌ Usage: .json <json string>\nOr reply to a message containing JSON\n\nExample: .json {"name":"John","age":30}');
      }

      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);

      const reply = `╭━━〔 📋 JSON FORMATTER 〕━━⬣
┃ ✅ Valid JSON
┃ 📊 *Type:* ${Array.isArray(parsed) ? 'Array' : typeof parsed}
┃ 🔑 *Keys:* ${typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 'N/A'}
╰━━━━━━━━━━━━━━━━━━━━⬣

\`\`\`
${formatted.length > 2000 ? formatted.substring(0, 2000) + '\n...' : formatted}
\`\`\`

> *INFINITY MD*`;

      await extra.reply(reply);
    } catch (error) {
      if (error instanceof SyntaxError) {
        await extra.reply('❌ Invalid JSON! Please provide valid JSON text.');
      } else {
        await extra.reply(`❌ Error: ${error.message}`);
      }
    }
  }
};
