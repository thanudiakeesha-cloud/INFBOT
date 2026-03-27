const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

module.exports = {
  name: 'grayscale',
  aliases: ['greyscale', 'bw', 'blackwhite'],
  category: 'converter',
  description: 'Convert image to grayscale',
  usage: '.grayscale (reply to image)',

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
        return await extra.reply('📎 Reply to an image to convert to grayscale!');
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

      const tempDir = getTempDir();
      const timestamp = Date.now();
      const tempInput = path.join(tempDir, `gray_in_${timestamp}.png`);
      const tempOutput = path.join(tempDir, `gray_out_${timestamp}.png`);

      fs.writeFileSync(tempInput, mediaBuffer);

      const cmd = `"${ffmpegPath}" -i "${tempInput}" -vf "format=gray" -y "${tempOutput}"`;

      await new Promise((resolve, reject) => exec(cmd, (err) => err ? reject(err) : resolve()));

      const outputBuffer = fs.readFileSync(tempOutput);

      await sock.sendMessage(extra.from, {
        image: outputBuffer,
      }, { quoted: msg });

      deleteTempFile(tempInput);
      deleteTempFile(tempOutput);
    } catch (error) {
      console.error('grayscale error:', error);
      await extra.reply(`❌ Failed to convert to grayscale.\n\nError: ${error.message}`);
    }
  }
};
