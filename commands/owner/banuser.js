const database = require('../../database');

module.exports = {
  name: 'banuser',
  aliases: ['ban', 'unban', 'banlist'],
  category: 'owner',
  description: 'Ban/unban a user from using the bot',
  usage: '.banuser @user | .unban @user | .banlist',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const commandUsed = extra.command?.toLowerCase() || 'banuser';

      if (commandUsed === 'banlist') {
        const globalSettings = database.getGlobalSettingsSync();
        const bannedUsers = globalSettings.bannedUsers || [];

        if (bannedUsers.length === 0) {
          return extra.reply('📋 *Banned Users*\n\nNo users are currently banned.');
        }

        let text = `📋 *Banned Users* (${bannedUsers.length})\n\n`;
        bannedUsers.forEach((user, i) => {
          text += `${i + 1}. @${user.split('@')[0]}\n`;
        });

        return sock.sendMessage(extra.from, {
          text,
          mentions: bannedUsers
        }, { quoted: msg });
      }

      let target;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = ctx?.mentionedJid || [];

      if (mentioned.length > 0) {
        target = mentioned[0];
      } else if (ctx?.participant && ctx.quotedMessage) {
        target = ctx.participant;
      } else if (args[0]) {
        const num = args[0].replace(/[^0-9]/g, '');
        if (num) target = num + '@s.whatsapp.net';
      }

      if (!target) {
        return extra.reply('❌ Please mention or reply to a user!\nUsage: .banuser @user | .unban @user | .banlist');
      }

      const globalSettings = database.getGlobalSettingsSync();
      const bannedUsers = globalSettings.bannedUsers || [];

      if (commandUsed === 'unban') {
        const index = bannedUsers.indexOf(target);
        if (index === -1) {
          return extra.reply(`❌ @${target.split('@')[0]} is not banned.`);
        }

        bannedUsers.splice(index, 1);
        await database.updateGlobalSettings({ bannedUsers });

        return sock.sendMessage(extra.from, {
          text: `✅ @${target.split('@')[0]} has been unbanned and can use the bot again.`,
          mentions: [target]
        }, { quoted: msg });
      }

      if (bannedUsers.includes(target)) {
        return sock.sendMessage(extra.from, {
          text: `❌ @${target.split('@')[0]} is already banned.`,
          mentions: [target]
        }, { quoted: msg });
      }

      bannedUsers.push(target);
      await database.updateGlobalSettings({ bannedUsers });

      return sock.sendMessage(extra.from, {
        text: `🚫 @${target.split('@')[0]} has been banned from using the bot.`,
        mentions: [target]
      }, { quoted: msg });
    } catch (error) {
      console.error('Banuser command error:', error);
      await extra.reply('❌ Error managing banned users.');
    }
  }
};
