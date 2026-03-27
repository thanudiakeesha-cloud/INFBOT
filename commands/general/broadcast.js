// plugins/broadcast_list.js
// Admin-only broadcast to a fixed number list (Sri Lanka +94)
// Command: .broadcast <message>
// Aliases: .brodcast, .bc

const isOwnerOrSudo = async (number) => {
  const config = require('../../config');
  return config.ownerNumber.some(owner => owner.includes(number));
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Put numbers as "94XXXXXXXXX" (NO leading 0)
const BROADCAST_NUMBERS = [
  "94707040302", // Thevidu
  "94762808184", // Thisen
  "94741288404", // Manuga (if wrong, change here)
  "94771730169", // Ranula
  "94772096982", // Adithya
  "94710996050", // Dinuka
  "94772894413", // Chandana
  "94728705444", // Thidev
  "94772079981", // Thamal
];

// Normalize just in case someone edits list with +, spaces, or leading 0
function normalizeSriNumber(input) {
  let n = String(input || "").replace(/[^\d]/g, ""); // keep digits only

  // If someone put 0XXXXXXXXX -> convert to 94XXXXXXXXX
  if (n.length === 10 && n.startsWith("0")) n = "94" + n.slice(1);

  // If someone put +94XXXXXXXXX -> becomes 94XXXXXXXXX already after strip
  // Ensure starts with 94 and length looks right (94 + 9 digits = 11)
  if (!n.startsWith("94")) return null;
  if (n.length !== 11) return null;

  return n;
}

async function isGroupAdmin(sock, chatId, senderJid) {
  if (!chatId.endsWith("@g.us")) return false;

  try {
    const meta = await sock.groupMetadata(chatId);
    const admins = (meta.participants || [])
      .filter(p => p.admin) // "admin" or "superadmin"
      .map(p => p.id);

    return admins.includes(senderJid);
  } catch (e) {
    return false;
  }
}

module.exports = {
  command: "broadcast",
  aliases: ["brodcast", "bc"],
  category: "admin",
  description: "Broadcast a message to a fixed number list (+94)",
  usage: ".broadcast <message>",

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    const senderJid =
      message.key.participant ||
      message.key.remoteJid; // for private chats it's remoteJid

    // ✅ Admin-only: group admin OR owner/sudo
    const ownerOk = await isOwnerOrSudo((senderJid || "").split("@")[0]);
    const adminOk = await isGroupAdmin(sock, chatId, senderJid);

    if (!ownerOk && !adminOk) {
      return sock.sendMessage(chatId, { text: "❌ Admin only (or bot owner)." }, { quoted: message });
    }

    const text = args.join(" ").trim();
    if (!text) {
      return sock.sendMessage(
        chatId,
        { text: "Usage: .broadcast <message>\nExample: .broadcast Hello!" },
        { quoted: message }
      );
    }

    // Build JID list
    const targets = BROADCAST_NUMBERS
      .map(normalizeSriNumber)
      .filter(Boolean)
      .map(n => `${n}@s.whatsapp.net`);

    if (!targets.length) {
      return sock.sendMessage(chatId, { text: "⚠️ Broadcast list is empty/invalid." }, { quoted: message });
    }

    const DELAY_MS = 1200; // increase if you want safer sending
    let sent = 0, failed = 0;

    await sock.sendMessage(
      chatId,
      { text: `📣 Broadcasting to ${targets.length} numbers...` },
      { quoted: message }
    );

    for (const jid of targets) {
      try {
        await sock.sendMessage(jid, { text });
        sent++;
      } catch (e) {
        failed++;
      }
      await sleep(DELAY_MS);
    }

    return sock.sendMessage(
      chatId,
      {
        text:
          `✅ Broadcast done.\n\n` +
          `Targets: ${targets.length}\n` +
          `Sent: ${sent}\n` +
          `Failed: ${failed}\n` +
          `Delay: ${DELAY_MS}ms`,
      },
      { quoted: message }
    );
  },
};
