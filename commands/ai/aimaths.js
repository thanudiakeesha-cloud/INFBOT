const axios = require('axios');

const API_KEY = 'qasim-dev';
const API_URL = 'https://api.qasimdev.dpdns.org/api/mistral/ai';

// split long WA messages safely
function splitText(text, size = 3900) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  command: 'aimaths',
  aliases: ['ai', 'mistral'],
  category: 'ai',
  description: 'Ask AI (Mistral Small).',
  usage: '.aimaths <question> OR reply with .aimaths',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      // get prompt from args OR replied message
      let prompt = args.join(' ').trim();

      const replied =
        message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!prompt && replied) {
        prompt =
          replied?.conversation ||
          replied?.extendedTextMessage?.text ||
          '';
      }

      if (!prompt) {
        return await sock.sendMessage(
          chatId,
          { text: '❌ Usage: .aimaths <question>\nOr reply to a message with .aimaths' },
          { quoted: message }
        );
      }

      await sock.sendMessage(chatId, { text: '🤖 Thinking...' }, { quoted: message });

      const res = await axios.get(API_URL, {
        timeout: 60000,
        params: {
          text: prompt,
          apiKey: API_KEY,
          max_tokens: 1024,
          temperature: 0.7
        },
        validateStatus: () => true
      });

      if (res.status !== 200 || !res.data?.success) {
        return await sock.sendMessage(
          chatId,
          { text: '❌ AI request failed.' },
          { quoted: message }
        );
      }

      const reply = res.data?.data?.result || 'No response.';
      const usage = res.data?.data?.usage;

      const finalText =
        `🧠 *AI Response*\n\n${reply}\n\n` +
        (usage
          ? `📊 Tokens: ${usage.total_tokens} (prompt ${usage.prompt_tokens}, completion ${usage.completion_tokens})`
          : '');

      // split if long
      const parts = splitText(finalText);

      for (const part of parts) {
        await sock.sendMessage(chatId, { text: part }, { quoted: message });
      }

    } catch (err) {
      console.error('AI plugin error:', err?.message || err);
      await sock.sendMessage(
        chatId,
        { text: '❌ Error contacting AI service.' },
        { quoted: message }
      );
    }
  }
};
