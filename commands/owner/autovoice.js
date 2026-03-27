const database = require('../../database');

module.exports = {
    name: 'autovoice',
    aliases: ['voice', 'autovn'],
    category: 'owner',
    description: 'Toggle auto-voice (recording) indicator',
    usage: '.autovoice <on|off>',
    ownerOnly: true,

    async execute(sock, message, args, context = {}) {
        const chatId = context.from || message.key.remoteJid;
        const action = args[0]?.toLowerCase();

        try {
            const settings = database.getGlobalSettingsSync();
            const isEnabled = settings.autoVoice || false;

            if (!action) {
                return sock.sendMessage(chatId, {
                    text: `🎤 *AUTOVOICE STATUS*\n\nCurrent: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n\nUse \`.autovoice on\` or \`.autovoice off\``
                }, { quoted: message });
            }

            if (action === 'on' || action === 'enable') {
                await database.updateGlobalSettings({ autoVoice: true, autoTyping: false });
                return sock.sendMessage(chatId, { text: '✅ *Auto-voice enabled!*\n_Recording indicator will show on every message._' }, { quoted: message });
            } else if (action === 'off' || action === 'disable') {
                await database.updateGlobalSettings({ autoVoice: false });
                return sock.sendMessage(chatId, { text: '❌ *Auto-voice disabled!*' }, { quoted: message });
            } else {
                return sock.sendMessage(chatId, { text: '❌ Use: `.autovoice on/off`' }, { quoted: message });
            }
        } catch (error) {
            console.error('Error in autovoice command:', error);
            return sock.sendMessage(chatId, { text: '❌ Error processing command.' }, { quoted: message });
        }
    }
};
