/**
 * Database Module - Firebase Realtime Database (primary) + SQLite (local backup)
 * All data is stored in Firebase and kept in memory for sync reads.
 * SQLite is kept as a local fallback cache.
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const fb = require('./firebase');

// ─── SQLite Setup (local backup) ──────────────────────────────────────────────
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = sqlite3(path.join(dbDir, 'bot.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function initSQLite() {
  db.exec(`CREATE TABLE IF NOT EXISTS dashboard_users (username TEXT PRIMARY KEY, password TEXT, data TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId TEXT, folder TEXT, name TEXT, ownerName TEXT, ownerNumber TEXT, settings TEXT DEFAULT '{}', creds TEXT, addedAt INTEGER)`);
  db.exec(`CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS group_settings (groupId TEXT PRIMARY KEY, settings TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS moderators (userId TEXT PRIMARY KEY)`);
  db.exec(`CREATE TABLE IF NOT EXISTS user_settings (username TEXT PRIMARY KEY, settings TEXT DEFAULT '{}')`);
  db.exec(`CREATE TABLE IF NOT EXISTS warnings (groupId TEXT, userId TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (groupId, userId))`);
}

try { initSQLite(); } catch (e) { console.error('❌ SQLite init error:', e.message); }

// ─── In-Memory Caches (for sync reads) ────────────────────────────────────────
let globalSettingsCache = {
  maintenance: false,
  forceBot: false,
  antidelete: false,
  autoStatus: false,
  anticall: false
};
let moderatorsCache = [];
let sessionsCache = {};
let groupSettingsCache = {};
let dashboardUsersCache = {};
let userSettingsCache = {};
let warningsCache = {};

// ─── Key Sanitization ─────────────────────────────────────────────────────────
const { sanitizeKey, desanitizeKey, fbSet, fbGet, fbUpdate, fbRemove } = fb;

// ─── Firebase Write (non-blocking, writes to both Firebase + SQLite) ───────────
function firebaseWrite(path, value) {
  fbSet(path, value).catch(() => {});
}
function firebaseUpdate(path, value) {
  fbUpdate(path, value).catch(() => {});
}
function firebaseRemove(path) {
  fbRemove(path).catch(() => {});
}

// ─── Bootstrap: Load from Firebase, migrate from SQLite if needed ──────────────
let _ready = false;
let _readyResolve;
const readyPromise = new Promise(r => { _readyResolve = r; });

async function bootstrapFromFirebase() {
  try {
    console.log('🔥 Loading data from Firebase...');

    // Load global settings
    const fbGlobalSettings = await fbGet('global_settings');
    if (fbGlobalSettings && typeof fbGlobalSettings === 'object') {
      Object.assign(globalSettingsCache, fbGlobalSettings);
      // Also sync to SQLite
      const stmt = db.prepare(`INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)`);
      for (const [k, v] of Object.entries(fbGlobalSettings)) {
        try { stmt.run(k, JSON.stringify(v)); } catch {}
      }
    } else {
      // Migrate from SQLite to Firebase
      const rows = db.prepare('SELECT * FROM global_settings').all();
      if (rows.length > 0) {
        const settings = {};
        rows.forEach(row => {
          try { settings[row.key] = JSON.parse(row.value); }
          catch { settings[row.key] = row.value; }
          globalSettingsCache[row.key] = settings[row.key];
        });
        await fbSet('global_settings', settings);
        console.log('📤 Migrated global_settings to Firebase');
      }
    }

    // Load sessions
    const fbSessions = await fbGet('sessions');
    if (fbSessions && typeof fbSessions === 'object') {
      for (const [sKey, data] of Object.entries(fbSessions)) {
        const id = desanitizeKey(sKey);
        sessionsCache[id] = {
          ...data,
          settings: typeof data.settings === 'string' ? JSON.parse(data.settings) : (data.settings || {})
        };
        // Sync to SQLite (without creds to save space)
        try {
          db.prepare(`INSERT OR REPLACE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, creds, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), data.creds || null, data.addedAt || Date.now());
        } catch {}
      }
      console.log(`📥 Loaded ${Object.keys(fbSessions).length} sessions from Firebase`);
    } else {
      // Migrate sessions from SQLite to Firebase
      const rows = db.prepare('SELECT * FROM sessions').all();
      if (rows.length > 0) {
        for (const row of rows) {
          const id = row.id;
          const data = {
            userId: row.userId || null,
            folder: row.folder || null,
            name: row.name || null,
            ownerName: row.ownerName || null,
            ownerNumber: row.ownerNumber || null,
            settings: JSON.parse(row.settings || '{}'),
            creds: row.creds || null,
            addedAt: row.addedAt || Date.now()
          };
          sessionsCache[id] = data;
          await fbSet(`sessions/${sanitizeKey(id)}`, { ...data, settings: data.settings });
        }
        console.log(`📤 Migrated ${rows.length} sessions to Firebase`);
      }
      // Also check sessions.json
      const sessionsJsonPath = path.join(dbDir, 'sessions.json');
      if (fs.existsSync(sessionsJsonPath)) {
        try {
          const jsonSessions = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
          for (const [id, data] of Object.entries(jsonSessions)) {
            if (!sessionsCache[id]) {
              sessionsCache[id] = { ...data, settings: data.settings || {} };
              await fbSet(`sessions/${sanitizeKey(id)}`, sessionsCache[id]);
            }
          }
          console.log('📤 Migrated sessions.json to Firebase');
        } catch {}
      }
    }

    // Load dashboard users
    const fbUsers = await fbGet('dashboard_users');
    if (fbUsers && typeof fbUsers === 'object') {
      Object.assign(dashboardUsersCache, fbUsers);
      for (const [username, data] of Object.entries(fbUsers)) {
        try {
          db.prepare(`INSERT OR REPLACE INTO dashboard_users (username, password, data) VALUES (?, ?, ?)`)
            .run(username, data.password, JSON.stringify(data.data || {}));
        } catch {}
      }
      console.log(`📥 Loaded ${Object.keys(fbUsers).length} dashboard users from Firebase`);
    } else {
      const rows = db.prepare('SELECT * FROM dashboard_users').all();
      if (rows.length > 0) {
        const users = {};
        rows.forEach(row => {
          users[row.username] = { password: row.password, data: JSON.parse(row.data || '{}') };
          dashboardUsersCache[row.username] = users[row.username];
        });
        await fbSet('dashboard_users', users);
        console.log(`📤 Migrated ${rows.length} dashboard users to Firebase`);
      }
    }

    // Load moderators
    const fbMods = await fbGet('moderators');
    if (fbMods && typeof fbMods === 'object') {
      moderatorsCache = Object.keys(fbMods).map(k => desanitizeKey(k));
      for (const userId of moderatorsCache) {
        try { db.prepare(`INSERT OR IGNORE INTO moderators (userId) VALUES (?)`).run(userId); } catch {}
      }
    } else {
      const rows = db.prepare('SELECT userId FROM moderators').all();
      if (rows.length > 0) {
        moderatorsCache = rows.map(r => r.userId);
        const modsObj = {};
        moderatorsCache.forEach(id => { modsObj[sanitizeKey(id)] = true; });
        await fbSet('moderators', modsObj);
        console.log(`📤 Migrated ${rows.length} moderators to Firebase`);
      }
    }

    // Load group settings
    const fbGroups = await fbGet('group_settings');
    if (fbGroups && typeof fbGroups === 'object') {
      for (const [gKey, settings] of Object.entries(fbGroups)) {
        const groupId = desanitizeKey(gKey);
        groupSettingsCache[groupId] = typeof settings === 'string' ? JSON.parse(settings) : settings;
        try {
          db.prepare(`INSERT OR REPLACE INTO group_settings (groupId, settings) VALUES (?, ?)`)
            .run(groupId, JSON.stringify(groupSettingsCache[groupId]));
        } catch {}
      }
      console.log(`📥 Loaded ${Object.keys(fbGroups).length} group settings from Firebase`);
    } else {
      const rows = db.prepare('SELECT * FROM group_settings').all();
      if (rows.length > 0) {
        const groups = {};
        rows.forEach(row => {
          try {
            const s = JSON.parse(row.settings);
            groupSettingsCache[row.groupId] = s;
            groups[sanitizeKey(row.groupId)] = s;
          } catch {}
        });
        await fbSet('group_settings', groups);
        console.log(`📤 Migrated ${rows.length} group settings to Firebase`);
      }
    }

    // Load user settings
    const fbUserSettings = await fbGet('user_settings');
    if (fbUserSettings && typeof fbUserSettings === 'object') {
      for (const [username, settings] of Object.entries(fbUserSettings)) {
        userSettingsCache[username] = typeof settings === 'string' ? JSON.parse(settings) : settings;
        try {
          db.prepare(`INSERT OR REPLACE INTO user_settings (username, settings) VALUES (?, ?)`)
            .run(username, JSON.stringify(userSettingsCache[username]));
        } catch {}
      }
    } else {
      const rows = db.prepare('SELECT * FROM user_settings').all();
      if (rows.length > 0) {
        const usettings = {};
        rows.forEach(row => {
          try {
            const s = JSON.parse(row.settings);
            userSettingsCache[row.username] = s;
            usettings[row.username] = s;
          } catch {}
        });
        await fbSet('user_settings', usettings);
      }
    }

    // Load warnings
    const fbWarnings = await fbGet('warnings');
    if (fbWarnings && typeof fbWarnings === 'object') {
      for (const [gKey, userWarns] of Object.entries(fbWarnings)) {
        const groupId = desanitizeKey(gKey);
        warningsCache[groupId] = {};
        if (userWarns && typeof userWarns === 'object') {
          for (const [uKey, count] of Object.entries(userWarns)) {
            const userId = desanitizeKey(uKey);
            warningsCache[groupId][userId] = count;
          }
        }
      }
    } else {
      try {
        const rows = db.prepare('SELECT * FROM warnings').all();
        if (rows.length > 0) {
          const warns = {};
          rows.forEach(row => {
            if (!warningsCache[row.groupId]) warningsCache[row.groupId] = {};
            warningsCache[row.groupId][row.userId] = row.count;
            const gk = sanitizeKey(row.groupId);
            if (!warns[gk]) warns[gk] = {};
            warns[gk][sanitizeKey(row.userId)] = row.count;
          });
          await fbSet('warnings', warns);
        }
      } catch {}
    }

    console.log('✅ Global settings loaded into cache');
    _ready = true;
    _readyResolve(true);
  } catch (e) {
    console.error('❌ Firebase bootstrap error:', e.message);
    // Fall back to SQLite only
    try {
      const rows = db.prepare('SELECT * FROM global_settings').all();
      rows.forEach(row => {
        try { globalSettingsCache[row.key] = JSON.parse(row.value); }
        catch { globalSettingsCache[row.key] = row.value; }
      });
      moderatorsCache = db.prepare('SELECT userId FROM moderators').all().map(r => r.userId);
      const sessionRows = db.prepare('SELECT * FROM sessions').all();
      sessionRows.forEach(row => {
        sessionsCache[row.id] = {
          userId: row.userId, folder: row.folder, name: row.name,
          ownerName: row.ownerName, ownerNumber: row.ownerNumber,
          settings: JSON.parse(row.settings || '{}'),
          creds: row.creds, addedAt: row.addedAt
        };
      });
    } catch {}
    console.log('✅ Global settings loaded into cache (SQLite fallback)');
    _ready = true;
    _readyResolve(false);
  }
}

// Start bootstrap
bootstrapFromFirebase();

// ─── Module Exports ────────────────────────────────────────────────────────────
module.exports = {

  /** Wait for Firebase to finish loading */
  ready: () => readyPromise,

  // ── Dashboard Users ──
  saveDashboardUser: async (username, password) => {
    const data = dashboardUsersCache[username]?.data || {};
    dashboardUsersCache[username] = { password, data };
    // Firebase
    firebaseSet_(`dashboard_users/${sanitizeKey(username)}`, { password, data });
    // SQLite
    try { db.prepare(`INSERT OR REPLACE INTO dashboard_users (username, password, data) VALUES (?, ?, ?)`).run(username, password, JSON.stringify(data)); } catch {}
    return true;
  },

  getDashboardUser: async (username) => {
    if (dashboardUsersCache[username]) return { username, ...dashboardUsersCache[username] };
    // Try Firebase
    const fbUser = await fbGet(`dashboard_users/${sanitizeKey(username)}`);
    if (fbUser) { dashboardUsersCache[username] = fbUser; return { username, ...fbUser }; }
    // Try SQLite
    try { return db.prepare('SELECT * FROM dashboard_users WHERE username = ?').get(username); } catch { return null; }
  },

  // ── Global Settings ──
  getGlobalSettings: async () => globalSettingsCache,
  getGlobalSettingsSync: () => globalSettingsCache,

  updateGlobalSettings: async (settings) => {
    Object.assign(globalSettingsCache, settings);
    // Firebase
    firebaseUpdate('global_settings', settings);
    // SQLite
    try {
      const stmt = db.prepare(`INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)`);
      for (const [k, v] of Object.entries(settings)) stmt.run(k, JSON.stringify(v));
    } catch {}
    return true;
  },

  // ── Group Settings ──
  getGroupSettings: async (groupId) => {
    if (groupSettingsCache[groupId]) return groupSettingsCache[groupId];
    const { defaultGroupSettings } = require('./config');
    const defaults = { ...defaultGroupSettings };
    groupSettingsCache[groupId] = defaults;
    // Save defaults
    firebaseSet_(`group_settings/${sanitizeKey(groupId)}`, defaults);
    try { db.prepare(`INSERT OR IGNORE INTO group_settings (groupId, settings) VALUES (?, ?)`).run(groupId, JSON.stringify(defaults)); } catch {}
    return defaults;
  },

  updateGroupSettings: async (groupId, settings) => {
    const current = groupSettingsCache[groupId] || {};
    const updated = { ...current, ...settings };
    groupSettingsCache[groupId] = updated;
    // Firebase
    firebaseUpdate(`group_settings/${sanitizeKey(groupId)}`, settings);
    // SQLite
    try { db.prepare(`INSERT OR REPLACE INTO group_settings (groupId, settings) VALUES (?, ?)`).run(groupId, JSON.stringify(updated)); } catch {}
    return updated;
  },

  // ── Moderators ──
  getModerators: async () => moderatorsCache,
  isModerator: (userId) => moderatorsCache.includes(userId),

  addModerator: async (userId) => {
    if (!moderatorsCache.includes(userId)) {
      moderatorsCache.push(userId);
      firebaseSet_(`moderators/${sanitizeKey(userId)}`, true);
      try { db.prepare(`INSERT OR IGNORE INTO moderators (userId) VALUES (?)`).run(userId); } catch {}
    }
    return true;
  },

  removeModerator: async (userId) => {
    moderatorsCache = moderatorsCache.filter(id => id !== userId);
    firebaseRemove(`moderators/${sanitizeKey(userId)}`);
    try { db.prepare(`DELETE FROM moderators WHERE userId = ?`).run(userId); } catch {}
    return true;
  },

  // ── Sessions ──
  getAllSessions: async () => ({ ...sessionsCache }),

  saveSession: async (id, data) => {
    const existing = sessionsCache[id] || {};
    const sessionData = {
      userId: data.userId || existing.userId || null,
      folder: data.folder || existing.folder || null,
      name: data.name || existing.name || null,
      ownerName: data.ownerName || existing.ownerName || null,
      ownerNumber: data.ownerNumber || existing.ownerNumber || null,
      settings: data.settings || existing.settings || {},
      creds: data.creds || existing.creds || null,
      addedAt: data.addedAt || existing.addedAt || Date.now()
    };
    sessionsCache[id] = sessionData;
    // Firebase
    firebaseSet_(`sessions/${sanitizeKey(id)}`, sessionData);
    // SQLite
    try {
      db.prepare(`INSERT OR REPLACE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, creds, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, sessionData.userId, sessionData.folder, sessionData.name, sessionData.ownerName, sessionData.ownerNumber, JSON.stringify(sessionData.settings), sessionData.creds, sessionData.addedAt);
    } catch {}
    return true;
  },

  saveSessionCreds: async (id, creds) => {
    if (sessionsCache[id]) sessionsCache[id].creds = creds;
    // Firebase
    firebaseUpdate(`sessions/${sanitizeKey(id)}`, { creds });
    // SQLite
    try { db.prepare(`UPDATE sessions SET creds = ? WHERE id = ?`).run(creds, id); } catch {}
    return true;
  },

  deleteSession: async (id) => {
    delete sessionsCache[id];
    firebaseRemove(`sessions/${sanitizeKey(id)}`);
    try { db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id); } catch {}
    return true;
  },

  // ── User Settings ──
  getUserSettings: async (username) => {
    if (userSettingsCache[username]) return userSettingsCache[username];
    const fbData = await fbGet(`user_settings/${sanitizeKey(username)}`);
    if (fbData) { userSettingsCache[username] = fbData; return fbData; }
    return {};
  },

  updateUserSettings: async (username, settings) => {
    const current = userSettingsCache[username] || {};
    const updated = { ...current, ...settings };
    userSettingsCache[username] = updated;
    // Firebase
    firebaseSet_(`user_settings/${sanitizeKey(username)}`, updated);
    // SQLite
    try { db.prepare(`INSERT OR REPLACE INTO user_settings (username, settings) VALUES (?, ?)`).run(username, JSON.stringify(updated)); } catch {}
    return updated;
  },

  // ── Warnings ──
  addWarning: (groupId, userId, reason) => {
    if (!warningsCache[groupId]) warningsCache[groupId] = {};
    const count = (warningsCache[groupId][userId] || 0) + 1;
    warningsCache[groupId][userId] = count;
    // Firebase
    firebaseSet_(`warnings/${sanitizeKey(groupId)}/${sanitizeKey(userId)}`, count);
    // SQLite
    try {
      db.prepare(`INSERT INTO warnings (groupId, userId, count) VALUES (?, ?, 1) ON CONFLICT(groupId, userId) DO UPDATE SET count = count + 1`)
        .run(groupId, userId);
    } catch {}
    return count;
  },

  getWarnings: (groupId, userId) => {
    return warningsCache[groupId]?.[userId] || 0;
  },

  clearWarnings: (groupId, userId) => {
    if (warningsCache[groupId]) delete warningsCache[groupId][userId];
    firebaseRemove(`warnings/${sanitizeKey(groupId)}/${sanitizeKey(userId)}`);
    try { db.prepare(`DELETE FROM warnings WHERE groupId = ? AND userId = ?`).run(groupId, userId); } catch {}
    return true;
  },

  // ── Deleted Messages Cache (in-memory only) ──
  deletedMessagesCache: new Map(),
  saveDeletedMessage: (id, data) => {
    module.exports.deletedMessagesCache.set(id, data);
    setTimeout(() => module.exports.deletedMessagesCache.delete(id), 3600000);
  },
  getDeletedMessage: (id) => module.exports.deletedMessagesCache.get(id),

  // ── Raw SQL query (SQLite only, for legacy compatibility) ──
  query: async (sql, params = []) => {
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return db.prepare(sql).all(...params);
      }
      return db.prepare(sql).run(...params);
    } catch (e) {
      console.error('SQL query error:', e.message);
      return null;
    }
  },

  run: async (sql, params = []) => {
    try {
      return db.prepare(sql).run(...params);
    } catch (e) {
      console.error('SQL run error:', e.message);
      return null;
    }
  }
};

// Internal helper (avoids circular ref on module.exports not ready)
function firebaseSet_(path, value) {
  fbSet(path, value).catch(() => {});
}
