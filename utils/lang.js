/**
 * Language Manager — English (en) + Sinhala (si)
 * Per-chat preference stored in memory (persists for session lifetime).
 */

// ── In-memory store ──────────────────────────────────────────────────────────
const chatLangMap = new Map();

// ── Supported languages ───────────────────────────────────────────────────────
const LANGUAGES = {
  en: { name: 'English',  flag: '🇬🇧', label: 'English' },
  si: { name: 'සිංහල',   flag: '🇱🇰', label: 'Sinhala'  },
};

// ── Translations ──────────────────────────────────────────────────────────────
const STRINGS = {
  en: {
    // Main menu
    user:        'User',
    owner:       'Owner',
    prefix:      'Prefix',
    commands:    'Commands',
    uptime:      'Uptime',
    ram:         'RAM',
    categories:  'CATEGORIES',
    tapBtn:      'Tap a button below to explore commands',
    cmdReady:    'commands ready',
    // Category titles
    cat_media:   'Media & Downloads',
    cat_admin:   'Admin Commands',
    cat_owner:   'Owner Commands',
    cat_tools:   'Tools & AI',
    cat_general: 'General & Fun',
    // Submenu
    backMenu:    '🔙 Back to Menu',
    // Lang command
    currentLang: 'Current language',
    selectLang:  'Select your language',
    langChanged: 'Language changed to',
    langInvalid: 'Invalid. Use: .lang en  or  .lang si',
    // ── Command labels (2-3 words) ──
    song:         'Song download',
    yt:           'YouTube search',
    tiktok:       'TikTok download',
    ytmp3:        'YouTube → MP3',
    ytmp4:        'YouTube → MP4',
    play:         'Quick play',
    lyrics:       'Song lyrics',
    film:         'Movie finder',
    film1:        'SriHub movies',
    film3:        'SinhalaSub.lk',
    antilink:     'Block links',
    demote:       'Remove admin',
    goodbye:      'Leave message',
    hidetag:      'Silent mention',
    kick:         'Kick member',
    lock:         'Lock group',
    members:      'List members',
    mute:         'Mute group',
    promote:      'Make admin',
    setname:      'Rename group',
    tagall:       'Tag everyone',
    unlock:       'Unlock group',
    unmute:       'Unmute group',
    warn:         'Warn member',
    welcome:      'Join message',
    anticall:     'Block calls',
    antidelete:   'Catch deletes',
    antiviewonce: 'Save viewonce',
    autoreact:    'Auto react',
    autoreply:    'Auto reply',
    autostatus:   'Auto status',
    block:        'Block user',
    broadcast:    'Mass message',
    join:         'Join group',
    leave:        'Leave group',
    mode:         'Bot mode',
    settings:     'Bot settings',
    unblock:      'Unblock user',
    ai:           'AI chat',
    gpt:          'GPT chat',
    calc:         'Calculator',
    sticker:      'Make sticker',
    translate:    'Translate text',
    weather:      'Weather info',
    wiki:         'Wikipedia',
    togif:        'Video → GIF',
    toimg:        'Sticker → image',
    tomp3:        'Video → MP3',
    fact:         'Random fact',
    joke:         'Random joke',
    meme:         'Random meme',
    alive:        'Bot status',
    ping:         'Ping bot',
    owner:        'Owner info',
    runtime:      'System stats',
    lang:         'Change language',
  },

  si: {
    // Main menu
    user:        'පරිශීලකයා',
    owner:       'හිමිකරු',
    prefix:      'උපසර්ගය',
    commands:    'විධාන',
    uptime:      'ක්‍රියාකාලය',
    ram:         'මතකය',
    categories:  'ප්‍රවර්ග',
    tapBtn:      'විධාන බලන්න බොත්තමක් 누르න්න',
    cmdReady:    'විධාන සූදානම්',
    // Category titles
    cat_media:   'මාධ්‍ය සහ බාගත කිරීම්',
    cat_admin:   'පරිපාලක විධාන',
    cat_owner:   'හිමිකරු විධාන',
    cat_tools:   'මෙවලම් සහ AI',
    cat_general: 'සාමාන්‍ය සහ විනෝද',
    // Submenu
    backMenu:    '🔙 ප්‍රධාන මෙනුව',
    // Lang command
    currentLang: 'වත්මන් භාෂාව',
    selectLang:  'භාෂාව තෝරන්න',
    langChanged:  'භාෂාව වෙනස් විය',
    langInvalid: 'වලංගු නැත. .lang en හෝ .lang si භාවිත කරන්න',
    // ── Command labels ──
    song:         'ගීතය බාගන්න',
    yt:           'YouTube සෙවීම',
    tiktok:       'TikTok බාගන්න',
    ytmp3:        'YouTube → MP3',
    ytmp4:        'YouTube → MP4',
    play:         'ඉක්මනින් වාදනය',
    lyrics:       'ගීත පද',
    film:         'චිත්‍රපට සෙවීම',
    film1:        'SriHub චිත්‍රපට',
    film3:        'SinhalaSub.lk',
    antilink:     'සබැඳි අවහිර',
    demote:       'Admin ඉවත් කරන්න',
    goodbye:      'සමුගැනීමේ පණිවිඩ',
    hidetag:      'නිහඬ ඇමතීම',
    kick:         'සාමාජිකයා ඉවත්',
    lock:         'කණ්ඩායම අගුළු',
    members:      'සාමාජිකයින් ලැයිස්තු',
    mute:         'කණ්ඩායම නිශ්ශබ්ද',
    promote:      'Admin කරන්න',
    setname:      'නම වෙනස් කරන්න',
    tagall:       'සියල්ලන්ට Tag',
    unlock:       'අගුළු අරින්න',
    unmute:       'නිශ්ශබ්දය ඉවත්',
    warn:         'අනතුරු ඇඟවීම',
    welcome:      'සාදරයෙන් පිළිගැනීම',
    anticall:     'ඇමතුම් අවහිර',
    antidelete:   'මකාදැමීම් අල්ලා',
    antiviewonce: 'viewonce සුරකින්න',
    autoreact:    'ස්වයං ප්‍රතිචාර',
    autoreply:    'ස්වයං පිළිතුරු',
    autostatus:   'ස්වයං status',
    block:        'පරිශීලකයා අවහිර',
    broadcast:    'සාමූහික පණිවිඩ',
    join:         'කණ්ඩායමට සම්බන්ධ',
    leave:        'කණ්ඩායම හැර යන්න',
    mode:         'Bot ක්‍රමය',
    settings:     'Bot සැකසීම්',
    unblock:      'අවහිරය ඉවත්',
    ai:           'AI සංවාදය',
    gpt:          'GPT සංවාදය',
    calc:         'ගණකය',
    sticker:      'Sticker සාදන්න',
    translate:    'පරිවර්තනය',
    weather:      'කාලගුණය',
    wiki:         'Wikipedia',
    togif:        'Video → GIF',
    toimg:        'Sticker → රූපය',
    tomp3:        'Video → MP3',
    fact:         'අහඹු කරුණ',
    joke:         'හාස්‍ය කතාව',
    meme:         'Meme රූපය',
    alive:        'Bot තත්ත්වය',
    ping:         'Ping Bot',
    owner:        'හිමිකරු තොරතුරු',
    runtime:      'පද්ධති සංඛ්‍යා',
    lang:         'භාෂාව වෙනස් කරන්න',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────
function getLang(chatId) {
  return chatLangMap.get(String(chatId)) || 'en';
}

function setLang(chatId, lang) {
  if (!LANGUAGES[lang]) return false;
  chatLangMap.set(String(chatId), lang);
  return true;
}

/** Translate a key for the given language, falling back to English. */
function t(key, lang) {
  const l = LANGUAGES[lang] ? lang : 'en';
  return STRINGS[l][key] ?? STRINGS.en[key] ?? key;
}

module.exports = { getLang, setLang, t, LANGUAGES };
