# Project Overview

Infinity MD is a Node.js/Express WhatsApp multi-device bot dashboard. The main server is `index.js`, with dashboard pages in `views/`, bot commands in `commands/`, and Firebase/SQLite persistence in `database.js` and `firebase.js`.

## Current Architecture
- Runtime: Node.js CommonJS app started with `node index.js`.
- Web server: raw HTTP server starts first for health checks, then Express routes are registered.
- Persistence: Firebase Realtime Database is primary, SQLite is a local backup/cache.
- WhatsApp connectivity: Baileys powers active bot sessions, QR login, and pairing-code login.
- Deployment files: `railway.json`, `nixpacks.toml`, and `Procfile` configure Railway startup.

## Recent Changes
- Hardened `/api/pair` for Railway by retrying temporary Baileys socket creation and pairing-code requests before returning failure.
- Hardened `/api/qr` retry behavior so a QR produced by a retry socket is returned to the browser instead of timing out or reporting service unavailable.
- Added shared temporary socket helpers for safer cleanup, browser signature selection, and clearer WhatsApp readiness errors.
