const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

module.exports = {
  name: 'blur',
  aliases: ['blurimage', 'addblur'],
  category: 'converter',
  description: 'Blur an image',
  usage: '.blur (reply to image)',

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

      const mediaMessage = targetMessage.message?.imageMessage;
      if (!mediaMessage) {
        return await extra.reply('📎 Reply to an image to blur it!');
      }

      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage },
      );

      if (!mediaBuffer) {
        return await extra.reply('❌ Failed to download image.');
      }

      const level = parseInt(args[0]) || 10;
      const blurLevel = Math.min(Math.max(level, 1), 50);

      const tempDir = getTempDir();
      const timestamp = Date.now();
      const tempInput = path.join(tempDir, `blur_in_${timestamp}.png`);
      const tempOutput = path.join(tempDir, `blur_out_${timestamp}.png`);

      fs.writeFileSync(tempInput, mediaBuffer);

      const cmd = `"${ffmpegPath}" -i "${tempInput}" -vf "boxblur=${blurLevel}:${blurLevel}" -y "${tempOutput}"`;

      await new Promise((resolve, reject) => exec(cmd, (err) => err ? reject(err) : resolve()));

      const outputBuffer = fs.readFileSync(tempOutput);

      await sock.sendMessage(extra.from, {
        image: outputBuffer,
        caption: `🔵 Blurred with level: ${blurLevel}`,
      }, { quoted: msg });

      deleteTempFile(tempInput);
      deleteTempFile(tempOutput);
    } catch (error) {
      console.error('blur error:', error);
      await extra.reply(`❌ Failed to blur image.\n\nError: ${error.message}`);
    }
  }
};
