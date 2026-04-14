const config  = require('../../config');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { sendBtn, btn, urlBtn } = require('../../utils/sendBtn');
const { getLang, t, LANGUAGES } = require('../../utils/lang');

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ramBar(usedMB, totalMB) {
  const pct    = Math.min(100, Math.round((usedMB / totalMB) * 100));
  const filled = Math.round(pct / 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${bar} ${pct}%`;
}

function pickMenuImage() {
  const bannersDir = path.join(__dirname, '../../utils/banners');
  const fallback   = path.join(__dirname, '../../utils/bot_image.jpg');
  try {
    if (fs.existsSync(bannersDir)) {
      const files = fs.readdirSync(bannersDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (files.length) return path.join(bannersDir, files[Math.floor(Math.random() * files.length)]);
    }
  } catch (_) {}
  return fs.existsSync(fallback) ? fallback : null;
}

// Each cmd.desc is now a lang key (desc_*) so it can be translated
const CATEGORIES = {
  media: {
    icon: '📥', labelKey: 'cat_label_media',
    cmds: [
      { name: 'song',   descKey: 'desc_song'   },
      { name: 'yt',     descKey: 'desc_yt'     },
      { name: 'ytmp3',  descKey: 'desc_ytmp3'  },
      { name: 'ytmp4',  descKey: 'desc_ytmp4'  },
      { name: 'play',   descKey: 'desc_play'   },
      { name: 'tiktok', descKey: 'desc_tiktok' },
      { name: 'lyrics', descKey: 'desc_lyrics' },
    ],
  },
  admin: {
    icon: '🛡️', labelKey: 'cat_label_admin',
    cmds: [
      { name: 'antilink',  descKey: 'desc_antilink'  },
      { name: 'tagall',    descKey: 'desc_tagall'    },
      { name: 'hidetag',   descKey: 'desc_hidetag'   },
      { name: 'kick',      descKey: 'desc_kick'      },
      { name: 'promote',   descKey: 'desc_promote'   },
      { name: 'demote',    descKey: 'desc_demote'    },
      { name: 'mute',      descKey: 'desc_mute'      },
      { name: 'unmute',    descKey: 'desc_unmute'    },
      { name: 'lock',      descKey: 'desc_lock'      },
      { name: 'unlock',    descKey: 'desc_unlock'    },
      { name: 'welcome',   descKey: 'desc_welcome'   },
      { name: 'goodbye',   descKey: 'desc_goodbye'   },
      { name: 'members',   descKey: 'desc_members'   },
      { name: 'setname',   descKey: 'desc_setname'   },
      { name: 'warn',      descKey: 'desc_warn'      },
    ],
  },
  owner: {
    icon: '👑', labelKey: 'cat_label_owner',
    cmds: [
      { name: 'mode',         descKey: 'desc_mode'         },
      { name: 'settings',     descKey: 'desc_settings'     },
      { name: 'broadcast',    descKey: 'desc_broadcast'    },
      { name: 'block',        descKey: 'desc_block'        },
      { name: 'unblock',      descKey: 'desc_unblock'      },
      { name: 'join',         descKey: 'desc_join'         },
      { name: 'leave',        descKey: 'desc_leave'        },
      { name: 'anticall',     descKey: 'desc_anticall'     },
      { name: 'antidelete',   descKey: 'desc_antidelete'   },
      { name: 'antiviewonce', descKey: 'desc_antiviewonce' },
      { name: 'autoreact',    descKey: 'desc_autoreact'    },
      { name: 'autoreply',    descKey: 'desc_autoreply'    },
      { name: 'autostatus',   descKey: 'desc_autostatus'   },
    ],
  },
  tools: {
    icon: '🛠️', labelKey: 'cat_label_tools',
    cmds: [
      { name: 'ai',        descKey: 'desc_ai'        },
      { name: 'gpt',       descKey: 'desc_gpt'       },
      { name: 'calc',      descKey: 'desc_calc'      },
      { name: 'translate', descKey: 'desc_translate' },
      { name: 'weather',   descKey: 'desc_weather'   },
      { name: 'wiki',      descKey: 'desc_wiki'      },
      { name: 'sticker',   descKey: 'desc_sticker'   },
      { name: 'togif',     descKey: 'desc_togif'     },
      { name: 'toimg',     descKey: 'desc_toimg'     },
      { name: 'tomp3',     descKey: 'desc_tomp3'     },
    ],
  },
  fun: {
    icon: '🎮', labelKey: 'cat_label_fun',
    cmds: [
      { name: 'fact',    descKey: 'desc_fact'    },
      { name: 'joke',    descKey: 'desc_joke'    },
      { name: 'meme',    descKey: 'desc_meme'    },
      { name: 'alive',   descKey: 'desc_alive'   },
      { name: 'ping',    descKey: 'desc_ping'    },
      { name: 'owner',   descKey: 'desc_owner'   },
      { name: 'runtime', descKey: 'desc_runtime' },
      { name: 'lang',    descKey: 'desc_lang'    },
      { name: 'save',    descKey: 'desc_save'    },
    ],
  },
};

const ALIAS_MAP = {
  mediamenu: 'media', dlmenu: 'media', downloadmenu: 'media',
  adminmenu: 'admin',
  ownermenu: 'owner',
  toolsmenu: 'tools', toolmenu: 'tools', utilitymenu: 'tools', aimenu: 'tools', convertermenu: 'tools',
  funmenu: 'fun', generalmenu: 'fun',
};

const MAIN_BUTTONS = [
  btn('mediamenu', '📥 Media'),
  btn('adminmenu', '🛡️ Admin'),
  btn('ownermenu', '👑 Owner'),
  btn('toolsmenu', '🛠️ Tools'),
  btn('funmenu',   '🎮 Fun'),
];

function buildMainMenu({ botName, ownerName, senderNum, uptimeStr, ramMB, prefix, lang }) {
  const totalCmds = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
  const totalMB   = Math.round(os.totalmem() / 1024 / 1024);
  const bar       = ramBar(Number(ramMB), totalMB);

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t('greeting_morning',   lang)
    : hour < 17
      ? t('greeting_afternoon', lang)
      : t('greeting_evening',   lang);

  let tx = '';
  tx += `┏━━━━━━━━━━━━━━━━━┓\n`;
  tx += `┃  ♾️  *${botName}*\n`;
  tx += `┃  _WhatsApp Multi-Bot Manager_\n`;
  tx += `┗━━━━━━━━━━━━━━━━━┛\n\n`;

  tx += `${greeting}, @${senderNum}! 👋\n\n`;

  tx += `┌── 📊 *${t('menu_bot_status', lang)}* ──\n`;
  tx += `│ 👑 *${t('owner', lang)}  :* ${ownerName}\n`;
  tx += `│ ⌨️  *${t('prefix', lang)} :* \`${prefix}\`\n`;
  tx += `│ ⏱️  *${t('uptime', lang)} :* ${uptimeStr}\n`;
  tx += `│ 💾 *${t('ram', lang)}    :* ${bar}\n`;
  tx += `│ 📦 *${t('menu_total', lang)}  :* ${totalCmds} ${t('menu_cmds', lang)}\n`;
  tx += `└────────────────────────\n\n`;

  tx += `┌─── 📋 *${t('categories', lang)}* ──\n`;
  for (const [, cat] of Object.entries(CATEGORIES)) {
    const n    = cat.cmds.length;
    const dots = '●'.repeat(Math.min(n, 10)) + '○'.repeat(Math.max(0, 10 - n));
    const label = t(cat.labelKey, lang);
    tx += `│\n`;
    tx += `│  ${cat.icon}  *${label}*\n`;
    tx += `│     ${dots}  ${n} ${t('menu_cmds', lang)}\n`;
  }
  tx += `└────────────────────────\n\n`;
  tx += `> ${t('menu_tap', lang)}\n`;
  tx += `> ${t('menu_type_help', lang).replace('{prefix}', prefix)}`;

  return tx;
}

function buildSubmenu(catKey, prefix, lang) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;

  const label = t(cat.labelKey, lang);

  let tx = `┏━━━━━━━━━━━━━━━━━┓\n`;
  tx += `┃  ${cat.icon}  *${label}*\n`;
  tx += `┗━━━━━━━━━━━━━━━━━┛\n\n`;

  cat.cmds.forEach((cmd, i) => {
    const num  = String(i + 1).padStart(2, '0');
    const desc = t(cmd.descKey, lang);
    tx += `│ *${num}.* \`${prefix}${cmd.name}\`\n`;
    tx += `│      ╰ ${desc}\n`;
  });

  tx += `\n> 📌 _${cat.cmds.length} ${t('cmds_available', lang)}_\n`;
  tx += `> 💬 _${t('send_cmd_usage', lang)}_`;

  return tx;
}

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'mediamenu', 'dlmenu', 'downloadmenu',
    'adminmenu',
    'ownermenu',
    'aimenu',
    'toolmenu', 'toolsmenu', 'utilitymenu',
    'convertermenu',
    'funmenu', 'generalmenu',
  ],
  category: 'general',
  description: 'Show all bot commands and submenus',
  usage: 'menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId    = extra?.from || msg?.key?.remoteJid;
    const sender    = extra?.sender || msg?.key?.participant || chatId;
    const prefix    = sock?._customConfig?.settings?.prefix || config.prefix || '.';
    const botName   = sock?._customConfig?.botName || String(config.botName || 'Infinity MD Mini');
    const ownerName = sock?._customConfig?.ownerName
                      || (Array.isArray(config.ownerName) ? config.ownerName[0] : config.ownerName)
                      || 'Owner';

    const lang      = getLang(chatId);
    const senderNum = String(sender).split('@')[0] || '';
    const uptimeStr = formatUptime(process.uptime());
    const ramMB     = (process.memoryUsage().rss / 1024 / 1024).toFixed(0);

    const imgPath = pickMenuImage();
    const image   = imgPath ? { url: imgPath } : undefined;

    const usedCmd = String(extra?.commandName || '').toLowerCase().replace(prefix, '');
    const subArg  = args[0] ? String(args[0]).toLowerCase() : null;

    const submenuKey =
      ALIAS_MAP[usedCmd]  ||
      ALIAS_MAP[subArg]   ||
      (CATEGORIES[usedCmd] ? usedCmd : null) ||
      (CATEGORIES[subArg]  ? subArg  : null);

    if (submenuKey) {
      const cat  = CATEGORIES[submenuKey];
      const text = buildSubmenu(submenuKey, prefix, lang);
      if (!text) return sock.sendMessage(chatId, { text: '❌ Unknown menu section.' }, { quoted: msg });

      const label = t(cat.labelKey, lang);
      return sendBtn(sock, chatId, {
        text,
        footer: `${cat.icon} ${label} · ${cat.cmds.length} ${t('menu_cmds', lang)}`,
        ...(image ? { image } : {}),
        buttons: [
          btn('menu', '🏠 ' + t('backMenu', lang).replace('🔙 ', '')),
          urlBtn('💬 Support', 'https://wa.me/94770612011'),
        ],
      }, { quoted: msg });
    }

    const totalCmds = Object.values(CATEGORIES).reduce((n, c) => n + c.cmds.length, 0);
    const text = buildMainMenu({ botName, ownerName, senderNum, uptimeStr, ramMB, prefix, lang });

    return sendBtn(sock, chatId, {
      text,
      footer: `♾️ ${botName} · ${totalCmds} ${t('cmdReady', lang)}`,
      ...(image ? { image } : {}),
      buttons: MAIN_BUTTONS,
      mentions: [sender],
    }, { quoted: msg });
  },
};
