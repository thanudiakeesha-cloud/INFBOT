module.exports = {
  name: 'whois',
  aliases: ['userinfo', 'profile', 'info'],
  category: 'general',
  description: 'Get info about a user (mention or reply)',
  usage: '.whois @user or reply to a message',

  async execute(sock, msg, args, extra) {
    try {
      let targetJid;

      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      if (ctxInfo?.mentionedJid?.length > 0) {
        targetJid = ctxInfo.mentionedJid[0];
      } else if (ctxInfo?.participant) {
        targetJid = ctxInfo.participant;
      } else {
        targetJid = extra.sender;
      }

      if (!targetJid) {
        return extra.reply('❌ Please mention a user or reply to their message.\n\nUsage: .whois @user');
      }

      await extra.react('🔍');

      const number = targetJid.split('@')[0];
      let profilePic;
      try {
        profilePic = await sock.profilePictureUrl(targetJid, 'image');
      } catch (e) {
        profilePic = null;
      }

      let status;
      try {
        const s = await sock.fetchStatus(targetJid);
        status = s?.status || 'No status';
      } catch (e) {
        status = 'Unable to fetch';
      }

      let isGroupAdmin = false;
      if (extra.isGroup && extra.groupMetadata?.participants) {
        const participant = extra.groupMetadata.participants.find(p =>
          p.id === targetJid || p.id.split(':')[0] === number
        );
        if (participant) {
          isGroupAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
        }
      }

      const text = `╭━━〔 👤 USER INFO 〕━━⬣
┃ 📱 *Number:* +${number}
┃ 🏷️ *JID:* ${targetJid}
┃ 📝 *Status:* ${status}
┃ 🖼️ *Profile Pic:* ${profilePic ? 'Yes' : 'No'}${extra.isGroup ? `\n┃ 🛡️ *Group Admin:* ${isGroupAdmin ? 'Yes' : 'No'}` : ''}
╰━━━━━━━━━━━━━━━━━━━━⬣

> *INFINITY MD*`;

      if (profilePic) {
        await sock.sendMessage(extra.from, {
          image: { url: profilePic },
          caption: text,
          mentions: [targetJid]
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, {
          text,
          mentions: [targetJid]
        }, { quoted: msg });
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
