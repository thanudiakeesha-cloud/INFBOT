const database = require('../../database');

async function isAutotypingEnabled() {
    try {
        const settings = database.getGlobalSettingsSync();
        return settings.autoTyping || false;
    } catch (error) {
        return false;
    }
}

async function isGhostModeActive() {
    try {
        const settings = database.getGlobalSettingsSync();
        return settings.stealthMode || false;
    } catch (error) {
        return false;
    }
}

async function handleAutotypingForMessage(sock, chatId, userMessage) {
    const ghostActive = await isGhostModeActive();
    if (ghostActive) return false;

    const enabled = await isAutotypingEnabled();
    if (enabled) {
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate('available', chatId);
            await new Promise(resolve => setTimeout(resolve, 500));
            await sock.sendPresenceUpdate('composing', chatId);
            const typingDelay = Math.max(3000, Math.min(8000, userMessage.length * 150));
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            await sock.sendPresenceUpdate('composing', chatId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            await sock.sendPresenceUpdate('paused', chatId);
            return true;
        } catch (error) {
            return false;
        }
    }
    return false;
}

async function handleAutotypingForCommand(sock, chatId) {
    const ghostActive = await isGhostModeActive();
    if (ghostActive) return false;

    const enabled = await isAutotypingEnabled();
    if (enabled) {
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate('available', chatId);
            await new Promise(resolve => setTimeout(resolve, 500));
            await sock.sendPresenceUpdate('composing', chatId);
            await new Promise(resolve => setTimeout(resolve, 3000));
            await sock.sendPresenceUpdate('composing', chatId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            await sock.sendPresenceUpdate('paused', chatId);
            return true;
        } catch (error) {
            return false;
        }
    }
    return false;
}

async function showTypingAfterCommand(sock, chatId) {
    const ghostActive = await isGhostModeActive();
    if (ghostActive) return false;

    const enabled = await isAutotypingEnabled();
    if (enabled) {
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate('composing', chatId);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendPresenceUpdate('paused', chatId);
            return true;
        } catch (error) {
            return false;
        }
    }
    return false;
}

module.exports = {
    command: 'autotyping',
    aliases: ['typing', 'autotype'],
    category: 'owner',
    description: 'Toggle auto-typing indicator when bot is processing messages',
    usage: '.autotyping <on|off>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        try {
            const settings = database.getGlobalSettingsSync();
            const isEnabled = settings.autoTyping || false;
            const action = args[0]?.toLowerCase();

            if (!action) {
                const ghostActive = await isGhostModeActive();
                await sock.sendMessage(chatId, {
                    text: `*⌨️ AUTOTYPING STATUS*\n\n` +
                          `*Current Status:* ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                          `*Ghost Mode:* ${ghostActive ? '👻 Active (blocks typing)' : '❌ Inactive'}\n\n` +
                          `*Commands:*\n` +
                          `• \`.autotyping on\` - Enable auto-typing\n` +
                          `• \`.autotyping off\` - Disable auto-typing`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }

            if (action === 'on' || action === 'enable') {
                if (isEnabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Autotyping is already enabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await database.updateGlobalSettings({ autoTyping: true });
                const ghostActive = await isGhostModeActive();
                await sock.sendMessage(chatId, {
                    text: `✅ *Auto-typing enabled!*\n\nThe bot will now show typing indicator while processing.${ghostActive ? '\n\n⚠️ *Ghost mode is active* - typing indicators are currently blocked.' : ''}`,
                    ...channelInfo
                }, { quoted: message });

            } else if (action === 'off' || action === 'disable') {
                if (!isEnabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Autotyping is already disabled*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await database.updateGlobalSettings({ autoTyping: false });
                await sock.sendMessage(chatId, {
                    text: '❌ *Auto-typing disabled!*\n\nThe bot will no longer show typing indicator.',
                    ...channelInfo
                }, { quoted: message });

            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid option!*\n\nUse: `.autotyping on/off`',
                    ...channelInfo
                }, { quoted: message });
            }

        } catch (error) {
            console.error('Error in autotyping command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Error processing command!*',
                ...channelInfo
            }, { quoted: message });
        }
    },

    isAutotypingEnabled,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    showTypingAfterCommand
};
