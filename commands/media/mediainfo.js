module.exports = {
  name: 'mediainfo',
  aliases: ['minfo', 'fileinfo'],
  category: 'media',
  description: 'Get information about a media file',
  usage: '.mediainfo (reply to a media message)',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;

      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
      let mediaMsg = null;
      let mediaType = null;

      for (const type of mediaTypes) {
        if (quoted[type]) {
          mediaMsg = quoted[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaMsg) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please reply to a media message (image, video, audio, document, or sticker).\n\nUsage: .mediainfo (reply to media)'
        }, { quoted: msg });
      }

      const info = [];
      info.push('📁 *Media Information*\n');

      const typeNames = {
        imageMessage: '🖼️ Image',
        videoMessage: '🎬 Video',
        audioMessage: '🎵 Audio',
        documentMessage: '📄 Document',
        stickerMessage: '🎨 Sticker'
      };

      info.push(`*Type:* ${typeNames[mediaType] || mediaType}`);

      if (mediaMsg.mimetype) info.push(`*MIME Type:* ${mediaMsg.mimetype}`);
      if (mediaMsg.fileLength) {
        const bytes = parseInt(mediaMsg.fileLength);
        let size;
        if (bytes < 1024) size = bytes + ' B';
        else if (bytes < 1024 * 1024) size = (bytes / 1024).toFixed(2) + ' KB';
        else if (bytes < 1024 * 1024 * 1024) size = (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        else size = (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        info.push(`*File Size:* ${size}`);
      }
      if (mediaMsg.fileName) info.push(`*File Name:* ${mediaMsg.fileName}`);
      if (mediaMsg.width) info.push(`*Width:* ${mediaMsg.width}px`);
      if (mediaMsg.height) info.push(`*Height:* ${mediaMsg.height}px`);
      if (mediaMsg.seconds) {
        const mins = Math.floor(mediaMsg.seconds / 60);
        const secs = mediaMsg.seconds % 60;
        info.push(`*Duration:* ${mins}:${secs.toString().padStart(2, '0')}`);
      }
      if (mediaMsg.ptt !== undefined) info.push(`*Voice Note:* ${mediaMsg.ptt ? 'Yes' : 'No'}`);
      if (mediaMsg.isAnimated !== undefined) info.push(`*Animated:* ${mediaMsg.isAnimated ? 'Yes' : 'No'}`);
      if (mediaMsg.caption) info.push(`*Caption:* ${mediaMsg.caption}`);
      if (mediaMsg.mediaKey) info.push(`*Media Key:* Available`);

      info.push('\n> 💫 *INFINITY MD*');

      await sock.sendMessage(chatId, {
        text: info.join('\n')
      }, { quoted: msg });

    } catch (error) {
      console.error('[MEDIAINFO] Error:', error?.message || error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to get media info: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
