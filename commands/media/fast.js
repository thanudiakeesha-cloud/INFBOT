const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  name: 'fast',
  aliases: ['speedup', 'speed'],
  category: 'media',
  description: 'Speed up an audio file',
  usage: '.fast (reply to audio)',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
      const audioMsg = quoted?.audioMessage;

      if (!audioMsg) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please reply to an audio message.\n\nUsage: .fast (reply to audio)'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
        : msg;

      const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const inputFile = path.join(tempDir, `fast_input_${Date.now()}.mp3`);
      const outputFile = path.join(tempDir, `fast_output_${Date.now()}.mp3`);

      fs.writeFileSync(inputFile, buffer);

      const speed = parseFloat(args[0]) || 1.5;
      const tempo = Math.min(Math.max(speed, 1.05), 2.0);

      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${inputFile}" -af "atempo=${tempo}" -y "${outputFile}"`, {
          timeout: 60000
        }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      if (!fs.existsSync(outputFile)) {
        throw new Error('FFmpeg processing failed');
      }

      const outputBuffer = fs.readFileSync(outputFile);

      await sock.sendMessage(chatId, {
        audio: outputBuffer,
        mimetype: 'audio/mpeg',
        fileName: 'sped_up.mp3'
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

      try { fs.unlinkSync(inputFile); } catch (e) {}
      try { fs.unlinkSync(outputFile); } catch (e) {}

    } catch (error) {
      console.error('[FAST] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Speed up failed: ' + (error?.message || 'FFmpeg may not be available')
      }, { quoted: msg });
    }
  }
};
