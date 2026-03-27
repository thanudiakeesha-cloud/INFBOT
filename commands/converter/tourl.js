const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

module.exports = {
  name: 'tourl',
  aliases: ['mediaurl', 'upload', 'tolink'],
  category: 'converter',
  description: 'Upload media and get a URL',
  usage: '.tourl (reply to media)',

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
        targetMessage.message?.imageMessage ||
        targetMessage.message?.videoMessage ||
        targetMessage.message?.audioMessage ||
        targetMessage.message?.documentMessage ||
        targetMessage.message?.stickerMessage;

      if (!mediaMessage) {
        return await extra.reply('📎 Reply to any media (image/video/audio/document) to upload!');
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

      await extra.reply('🔄 Uploading media...');

      const axios = require('axios');
      const FormData = require('form-data');

      const form = new FormData();
      const ext = mediaMessage.mimetype?.split('/')[1] || 'bin';
      form.append('file', mediaBuffer, { filename: `upload.${ext}` });

      const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      if (res.data?.data?.url) {
        const url = res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        await extra.reply(`✅ *Media Uploaded!*\n\n🔗 ${url}\n\n⏳ Link expires in 1 hour.`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('tourl error:', error);
      await extra.reply(`❌ Failed to upload media.\n\nError: ${error.message}`);
    }
  }
};
