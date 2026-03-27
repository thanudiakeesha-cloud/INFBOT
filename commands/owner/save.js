const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const statusStore = require('../../utils/statusStore');
const pino = require('pino');

// Deletes a message for everyone in the chat
async function deleteForEveryone(sock, chatId, key) {
  try {
    await sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        id: key.id,
        fromMe: true,
        ...(key.participant ? { participant: key.participant } : {})
      }
    });
  } catch (_) {}
}

// Downloads status media reliably using a reconstructed message key
async function downloadStatusMedia(sock, contextInfo, quoted, mediaType) {
  const stanzaId = contextInfo?.stanzaId;
  const participant = contextInfo?.participant;

  // Reconstruct the full message as if it came from status.broadcast
  const fakeMsg = {
    key: {
      remoteJid: 'status.broadcast',
      fromMe: false,
      id: stanzaId || 'unknown',
      ...(participant ? { participant } : {})
    },
    message: quoted
  };

  // Primary: downloadMediaMessage with reuploadRequest
  try {
    return await downloadMediaMessage(
      fakeMsg, 'buffer', {},
      { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
    );
  } catch (e1) {
    // Fallback: try reupload then download
    try {
      const reuploaded = await sock.updateMediaMessage(fakeMsg);
      return await downloadMediaMessage(
        reuploaded, 'buffer', {},
        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
      );
    } catch (e2) {
      throw new Error(`Download failed: ${e2.message}`);
    }
  }
}

module.exports = {
  name: 'save',
  aliases: ['sv'],
  description: 'Reply to a status with .save to save the media to your DM',
  usage: 'Reply to a status with .save',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, { from, sender, reply, react }) {
    const chatId = msg.key.remoteJid;

    try {
      // Extract context from any message type that could be a reply
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.audioMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;
      if (!quoted) return reply('❌ Reply to a status message with *.save*');

      await react('⏳');

      const messageType = Object.keys(quoted).find(k => k !== 'messageContextInfo');
      const stanzaId = contextInfo?.stanzaId;

      // ── Media status (image / video / audio) ──────────────────────────────
      if (['imageMessage', 'videoMessage', 'audioMessage'].includes(messageType)) {
        const media = quoted[messageType];
        let buffer = null;

        // 1. Try cache first (fastest, most reliable)
        if (stanzaId) {
          const cached = statusStore.getCache(stanzaId);
          if (cached?.buffer) {
            buffer = cached.buffer;
            console.log(`[Save] Using cached buffer for ${stanzaId}`);
          }
        }

        // 2. If not in cache, download fresh
        if (!buffer) {
          buffer = await downloadStatusMedia(sock, contextInfo, quoted, messageType);
        }

        const sendType = messageType === 'imageMessage' ? 'image'
          : messageType === 'videoMessage' ? 'video'
          : 'audio';

        const caption = sendType !== 'audio'
          ? (media.caption ? `${media.caption}\n\n` : '') + '> 💫 *Saved via Infinity MD*'
          : undefined;

        await sock.sendMessage(sender, {
          [sendType]: buffer,
          mimetype: media.mimetype,
          ...(media.fileName ? { fileName: media.fileName } : {}),
          ...(caption ? { caption } : {})
        });

        await react('✅');

        // Mark as saved in the store to prevent duplicate react-saves
        if (stanzaId) statusStore.markSaved(stanzaId);

        // Delete .save command for everyone
        await deleteForEveryone(sock, chatId, msg.key);

      // ── Text status ────────────────────────────────────────────────────────
      } else if (['conversation', 'extendedTextMessage'].includes(messageType)) {
        const text = quoted.conversation || quoted.extendedTextMessage?.text || '';
        if (!text) {
          await react('❌');
          return reply('❌ This status has no text content.');
        }

        await sock.sendMessage(sender, {
          text: `📝 *Status Text Saved*\n\n${text}\n\n> 💫 *Saved via Infinity MD*`
        });

        await react('✅');
        await deleteForEveryone(sock, chatId, msg.key);

      // ── Unsupported type ───────────────────────────────────────────────────
      } else {
        await react('❌');
        reply(`❌ Unsupported status type: *${messageType || 'unknown'}*`);
      }

    } catch (error) {
      console.error('[Save] Error:', error.message);
      await react('❌');
      reply('❌ Failed to save. Make sure you are replying to a status message.\n\n_Tip: Enable .statussave so the bot caches statuses for instant saving._');
    }
  }
};
