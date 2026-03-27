const { initializeApp, getApps } = require('firebase/app');
const {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  child,
  push,
  onValue
} = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyBRoTFN1U0F1YgpPmcP9GP7y4brsGolFjQ",
  authDomain: "cupcake-25862.firebaseapp.com",
  databaseURL: "https://cupcake-25862-default-rtdb.firebaseio.com",
  projectId: "cupcake-25862",
  storageBucket: "cupcake-25862.firebasestorage.app",
  messagingSenderId: "479443761968",
  appId: "1:479443761968:web:53d2094960eb83a386e6f5",
  measurementId: "G-8B2L4D0983"
};

let app;
let database;

function initFirebase() {
  try {
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
    database = getDatabase(app);
    console.log('🔥 Firebase initialized successfully');
    return true;
  } catch (e) {
    console.error('❌ Firebase init error:', e.message);
    return false;
  }
}

function getDB() {
  return database;
}

function dbRef(path) {
  return ref(database, path);
}

function sanitizeKey(key) {
  if (!key) return '_empty_';
  return String(key)
    .replace(/\./g, ',')
    .replace(/[#$[\]/]/g, '_');
}

function desanitizeKey(key) {
  if (!key) return key;
  return String(key).replace(/,/g, '.');
}

async function fbSet(path, value) {
  try {
    await set(ref(database, path), value);
    return true;
  } catch (e) {
    console.error(`❌ Firebase set error [${path}]:`, e.message);
    return false;
  }
}

async function fbGet(path) {
  try {
    const snapshot = await get(ref(database, path));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (e) {
    console.error(`❌ Firebase get error [${path}]:`, e.message);
    return null;
  }
}

async function fbUpdate(path, value) {
  try {
    await update(ref(database, path), value);
    return true;
  } catch (e) {
    console.error(`❌ Firebase update error [${path}]:`, e.message);
    return false;
  }
}

async function fbRemove(path) {
  try {
    await remove(ref(database, path));
    return true;
  } catch (e) {
    console.error(`❌ Firebase remove error [${path}]:`, e.message);
    return false;
  }
}

const initialized = initFirebase();

module.exports = {
  initialized,
  getDB,
  dbRef,
  sanitizeKey,
  desanitizeKey,
  fbSet,
  fbGet,
  fbUpdate,
  fbRemove
};
