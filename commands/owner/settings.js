const config = require('../../config');
const database = require('../../database');
const { sendBtn, btn, urlBtn, CHANNEL_URL } = require('../../utils/sendBtn');

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

async function showSettingsPanel(sock, msg, extra) {
  const gs = database.getGlobalSettingsSync();
  const on = '✅', off = '❌';
  const s = (v) => v ? on : off;

  let text = `⚙️ *BOT SETTINGS*\n`;
  text += `╭───〔 🤖 Bot Info 〕───\n`;
  text += `│ 📛 *Name* : ${config.botName || 'Infinity MD'}\n`;
  text += `│ ⌨️ *Prefix* : ${config.prefix || '.'}\n`;
  text += `│ ⏱ *Uptime* : ${formatUptime(process.uptime())}\n`;
  text += `╰────────────────────\n\n`;

  text += `╭───〔 🔐 Bot Mode 〕───\n`;
  text += `│ ${s(gs.forceBot)} *Private Mode*\n`;
  text += `│ ${s(gs.maintenance)} *Maintenance Mode*\n`;
  text += `╰────────────────────\n\n`;

  text += `╭───〔 🛡️ Protection 〕───\n`;
  text += `│ ${s(gs.antidelete)} *Anti-Delete*\n`;
  text += `│ ${s(gs.antiviewonce)} *Anti-ViewOnce*\n`;
  text += `│ ${s(gs.anticall)} *Anti-Call*\n`;
  text += `╰────────────────────\n\n`;

  text += `╭───〔 🤖 Auto Features 〕───\n`;
  text += `│ ${s(gs.autoReact)} *Auto-React*\n`;
  text += `│ ${s(gs.autoStatus)} *Auto-Status View*\n`;
  text += `│ ${s(gs.autoTyping)} *Auto-Typing*\n`;
  text += `│ ${s(gs.autoVoice)} *Auto-Voice*\n`;
  text += `╰────────────────────\n\n`;

  text += `╭───〔 📋 Commands 〕───\n`;
  text += `│ .settings <name> on/off\n`;
  text += `│ Names: antidelete, antiviewonce\n`;
  text += `│ anticall, autoreact, autostatus\n`;
  text += `│ autotyping, autovoice\n`;
  text += `│ maintenance, privatemode\n`;
  text += `╰────────────────────`;

  return sendBtn(sock, extra.from, {
    text,
    footer: `⚙️ Tap to toggle • Changes apply immediately`,
    buttons: [
      btn(gs.antidelete    ? 'settings_antidelete_off'    : 'settings_antidelete_on',
          `🛡️ AntiDelete: ${gs.antidelete    ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.antiviewonce  ? 'settings_antiviewonce_off'  : 'settings_antiviewonce_on',
          `👁️ AntiViewOnce: ${gs.antiviewonce  ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.anticall      ? 'settings_anticall_off'      : 'settings_anticall_on',
          `📵 AntiCall: ${gs.anticall      ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.autoReact     ? 'settings_autoreact_off'     : 'settings_autoreact_on',
          `⚡ AutoReact: ${gs.autoReact     ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.autoStatus    ? 'settings_autostatus_off'    : 'settings_autostatus_on',
          `👀 AutoStatus: ${gs.autoStatus    ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.autoTyping    ? 'settings_autotyping_off'    : 'settings_autotyping_on',
          `⌨️ AutoTyping: ${gs.autoTyping    ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.autoVoice     ? 'settings_autovoice_off'     : 'settings_autovoice_on',
          `🎙️ AutoVoice: ${gs.autoVoice     ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.maintenance   ? 'settings_maintenance_off'   : 'settings_maintenance_on',
          `🔧 Maintenance: ${gs.maintenance   ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
      btn(gs.forceBot      ? 'settings_privatemode_off'   : 'settings_privatemode_on',
          `🔒 PrivateMode: ${gs.forceBot      ? '✅ ON  →  Turn OFF' : '❌ OFF  →  Turn ON'}`),
    ]
  }, { quoted: msg });
}

module.exports = {
  name: 'settings',
  aliases: ['botsettings', 'botconfig'],
  description: 'View and manage all bot settings',
  usage: '.settings [setting] [on/off]',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      // Enforce owner-only
      if (!extra.isOwner) {
        return extra.reply('👑 Only the bot owner can access settings.');
      }

      // No args → show panel
      if (!args[0]) {
        return showSettingsPanel(sock, msg, extra);
      }

      const toggleSettings = {
        'antiviewonce' : 'antiviewonce',
        'antidelete'   : 'antidelete',
        'anticall'     : 'anticall',
        'autoreact'    : 'autoReact',
        'autostatus'   : 'autoStatus',
        'autotyping'   : 'autoTyping',
        'autovoice'    : 'autoVoice',
        'maintenance'  : 'maintenance',
        'privatemode'  : 'forceBot',
        'forcebot'     : 'forceBot',
      };

      const setting = args[0].toLowerCase();
      const value   = args[1] ? args[1].toLowerCase() : null;
      const settingKey = toggleSettings[setting];

      if (!settingKey) {
        return extra.reply(
          `❌ Unknown setting: *${setting}*\n\n` +
          `Available:\n` +
          Object.keys(toggleSettings).map(k => `• ${k}`).join('\n') +
          `\n\nUsage: .settings <name> on/off`
        );
      }

      const gs = database.getGlobalSettingsSync();

      if (!value || (value !== 'on' && value !== 'off')) {
        const current = gs[settingKey] ? 'ON' : 'OFF';
        return extra.reply(
          `⚙️ *${setting}* is currently: *${current}*\n\nUsage: .settings ${setting} on/off`
        );
      }

      const newValue = value === 'on';
      await database.updateGlobalSettings({ [settingKey]: newValue });

      const emoji = newValue ? '✅' : '❌';
      await extra.reply(`${emoji} *${setting}* turned *${value.toUpperCase()}*`);

      // Re-show updated settings panel
      return showSettingsPanel(sock, msg, extra);

    } catch (error) {
      console.error('Settings command error:', error);
      await extra.reply('❌ Error managing settings.');
    }
  }
};
