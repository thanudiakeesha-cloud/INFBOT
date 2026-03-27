const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { toPTT } = require('../../utils/converter');

module.exports = {
  name: 'toptt',
  aliases: ['tovn', 'tovoicenote', 'ptt'],
  category: 'converter',
  description: 'Convert audio to voice note (PTT)',
  usage: '.toptt (reply to audio/video)',

  async execute(sock, msg, args, extra) {
    try {
      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      let targetMessage = msg;

      if (ctxInfo?.quotedMessage) {
        targetMessage = {
          key: {
            remoteJid: extra.from,
            id: ctxInfo.stanzaId,
            participant: ctxInfo.participant,
          },
          message: ctxInfo.quotedMessage,
        };
      }

      const mediaMessage =
        targetMessage.message?.audioMessage ||
        targetMessage.message?.videoMessage ||
        targetMessage.message?.documentMessage;

      if (!mediaMessage) {
        return await extra.reply('📎 Reply to an audio or video to convert to voice note!');
      }

      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage },
      );

      if (!mediaBuffer) {
        return await extra.reply('❌ Failed to download media.');
      }

      await extra.reply('🔄 Converting to voice note...');

      const ext = mediaMessage.mimetype?.split('/')[1] || 'mp3';
      const pttBuffer = await toPTT(mediaBuffer, ext);

      await sock.sendMessage(extra.from, {
        audio: pttBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      }, { quoted: msg });
    } catch (error) {
      console.error('toptt error:', error);
      await extra.reply(`❌ Failed to convert to voice note.\n\nError: ${error.message}`);
    }
  }
};
