# Project Overview

Infinity MD is a Node.js/Express WhatsApp multi-device bot dashboard. The main server is `index.js`, with dashboard pages in `views/`, bot commands in `commands/`, and Firebase/SQLite persistence in `database.js` and `firebase.js`.

## Current Architecture
- Runtime: Node.js CommonJS app started with `node index.js`.
- Web server: raw HTTP server starts first for health checks, then Express routes are registered.
- Persistence: Firebase Realtime Database is primary, SQLite is a local backup/cache.
- WhatsApp connectivity: Baileys powers active bot sessions, QR login, and pairing-code login.
- Deployment files: `railway.json`, `nixpacks.toml`, and `Procfile` configure Railway startup.

## Recent Changes (Latest)
- Redesigned dashboard (`views/dashboard.html`) with a fully modern UI: animated gradient mesh background with floating orbs + grid lines, glassmorphism cards, vibrant gradient stat cards with icons, glowing session status rings (green for Online, amber for Paused), improved sidebar with active indicator bar, modern connect tabs, polished QR/pair-code display, and improved toast notifications.
- Added `Restart` button on offline/paused session cards to un-pause sessions directly from the dashboard.
- Fixed welcome message + bot manual re-sending on every reconnect: `firstConnectDone` flag is now persisted to Firebase via `patchSession()` and read from the database on every connect, so the message is sent only once per bot regardless of server restarts.
- Added max reconnect limit (20 attempts): sessions that fail to reconnect after 20 consecutive tries are auto-marked `paused: true` in Firebase. Health monitor and startup both skip paused sessions. Dashboard shows `Paused` status; Restart button clears the flag.
- Added `patchSession()` to database module for patching individual fields without overwriting the full session record.

## Previous Changes
- Hardened `/api/pair` for Railway by retrying temporary Baileys socket creation and pairing-code requests before returning failure.
- Hardened `/api/qr` retry behavior so a QR produced by a retry socket is returned to the browser instead of timing out or reporting service unavailable.
- Added shared temporary socket helpers for safer cleanup, browser signature selection, and clearer WhatsApp readiness errors.
- Added Railway deployment diagnostics at `/api/diagnostics/railway`, with optional deep socket testing via `?deep=1`.
- Updated the dashboard to show backend QR/pair failure details instead of hiding HTTP status or server messages.
- Added lazy WhatsApp core loading so QR/pair retries loading Baileys after startup, and made the `libsignal` dependency explicit for Railway installs.
- Updated Railway Nixpacks setup to include Git/OpenSSH and use an HTTPS lockfile URL for the WhatsApp `libsignal` dependency.
