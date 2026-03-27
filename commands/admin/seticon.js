module.exports = {
  name: 'seticon',
  aliases: ['setgroupicon', 'setgrouppp', 'setpp'],
  category: 'admin',
  description: 'Set group icon/profile picture',
  usage: '.seticon (reply to an image)',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,

  async execute(sock, msg, args, extra) {
    try {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = ctx?.quotedMessage;
      const isImage = msg.message?.imageMessage || quotedMsg?.imageMessage;

      if (!isImage) {
        return extra.reply('❌ Please send or reply to an image!\n\nExample: Reply to an image with .seticon');
      }

      const mediaMsg = msg.message?.imageMessage ? msg : {
        key: msg.key,
        message: { imageMessage: quotedMsg.imageMessage }
      };

      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});

      await sock.updateProfilePicture(extra.from, buffer);
      await extra.reply('✅ Group icon updated successfully!');

    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
