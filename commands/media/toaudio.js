const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  name: 'toaudio',
  aliases: ['mp3', 'extractaudio'],
  category: 'media',
  description: 'Convert video to audio (extract audio from video)',
  usage: '.toaudio (reply to video)',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
      const videoMsg = quoted?.videoMessage;

      if (!videoMsg) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please reply to a video message.\n\nUsage: .toaudio (reply to video)'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      await sock.sendMessage(chatId, {
        text: '🎵 _Extracting audio from video..._'
      }, { quoted: msg });

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
        : msg;

      const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {});

      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const inputFile = path.join(tempDir, `toaudio_input_${Date.now()}.mp4`);
      const outputFile = path.join(tempDir, `toaudio_output_${Date.now()}.mp3`);

      fs.writeFileSync(inputFile, buffer);

      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${inputFile}" -vn -acodec libmp3lame -ab 128k -y "${outputFile}"`, {
          timeout: 120000
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
        fileName: 'extracted_audio.mp3'
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

      try { fs.unlinkSync(inputFile); } catch (e) {}
      try { fs.unlinkSync(outputFile); } catch (e) {}

    } catch (error) {
      console.error('[TOAUDIO] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Audio extraction failed: ' + (error?.message || 'FFmpeg may not be available')
      }, { quoted: msg });
    }
  }
};
