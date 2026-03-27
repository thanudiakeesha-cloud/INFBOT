# Infinity MD Bot - Quick Start Guide

## 🚀 Getting Started with the API System

Your WhatsApp bot now has a complete REST API system with the following key features:

### What You Get Out of the Box

✅ **User Authentication** - Register, login, logout
✅ **Session Management** - Create, update, delete bot sessions  
✅ **QR Code Login** - Scan to add new WhatsApp bots
✅ **Pairing Code** - 8-digit code for devices without QR scanner
✅ **Bot Status Monitoring** - Check uptime, memory, active sessions
✅ **Web Dashboard** - Manage all your bots from one place

---

## 📋 API Endpoints Summary

### Authentication (No login required)
- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/login` - Login to your account
- `GET /api/auth/logout` - Logout

### Session Management (Login required)
- `GET /api/sessions` - List all your bot sessions
- `POST /api/session/add` - Add a new session from existing credentials
- `POST /api/session/update` - Update bot name, owner info, settings
- `POST /api/session/delete` - Delete a bot session
- `POST /api/session/restart` - Restart a bot session

### Connect New Bots (Login required)
- `GET /api/qr` - Generate WhatsApp QR code
- `POST /api/pair` - Generate 8-digit pairing code

### System Info (Login required)
- `GET /api/status` - Bot server status (uptime, memory, active sessions)
- `GET /api/user-info` - Current user information

---

## 🔐 How to Use the API

### Step 1: Register an Account

**Using cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypass"}'
```

**Using JavaScript:**
```javascript
fetch('http://localhost:5000/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ 
    username: 'myuser', 
    password: 'mypass' 
  })
}).then(r => r.json()).then(console.log)
```

### Step 2: Login

**Using cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"myuser","password":"mypass"}'
```

**Using JavaScript:**
```javascript
fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Saves session cookie
  body: JSON.stringify({ 
    username: 'myuser', 
    password: 'mypass' 
  })
}).then(r => r.json()).then(console.log)
```

### Step 3: Add Your First Bot

**Option A: Using QR Code**

1. Generate QR:
```bash
curl http://localhost:5000/api/qr?botName=MyBot&ownerName=John \
  -b cookies.txt
```

2. Scan the returned QR code with WhatsApp
3. Bot automatically connects!

**Option B: Using Pairing Code**

```bash
curl -X POST http://localhost:5000/api/pair \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "number": "94770612011",
    "botName": "MyBot",
    "ownerName": "John"
  }'
```

Enter the returned code on your WhatsApp device.

### Step 4: Check Your Bots

```bash
curl http://localhost:5000/api/sessions -b cookies.txt
```

Returns list of all your bot sessions with status.

---

## 🌐 Using the Web Dashboard

The easiest way to manage your bots:

1. Open `http://localhost:5000/`
2. Register or login
3. Use the web interface to:
   - Generate QR codes
   - Generate pairing codes
   - View all your bot sessions
   - Monitor bot status
   - Manage settings

Or use the **example-frontend.html** file in this project - it's a complete standalone example of integrating with the API.

---

## 💡 Common Use Cases

### Add a New Bot Session

```javascript
const response = await fetch('http://localhost:5000/api/qr', {
  credentials: 'include'
});
const { qr } = await response.json();

// Display QR image and let user scan
showQRCode(qr);
```

### Monitor Bot Health

```javascript
const response = await fetch('http://localhost:5000/api/status', {
  credentials: 'include'
});
const data = await response.json();

console.log(`Server uptime: ${data.uptimeFormatted}`);
console.log(`Memory used: ${data.memory.heapUsed}`);
console.log(`Active bots: ${data.activeSessions}`);
```

### List All Bots

```javascript
const response = await fetch('http://localhost:5000/api/sessions', {
  credentials: 'include'
});
const sessions = await response.json();

sessions.forEach(bot => {
  console.log(`${bot.name}: ${bot.status}`);
});
```

### Delete a Bot

```javascript
const response = await fetch('http://localhost:5000/api/session/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ sessionId: 'qr_94770612011_1234567' })
});
```

---

## 📱 Phone Number Format

Phone numbers must be in **international format without the + sign**:

✅ Correct:
- `94770612011` (Sri Lanka)
- `447911123456` (United Kingdom)
- `15551234567` (USA)

❌ Wrong:
- `+94770612011` (has +)
- `0770612011` (missing country code)
- `(+94) 770612011` (has parentheses)

---

## 🔒 Security Notes

1. **Session Cookies** - Automatically set after login, valid for 24 hours
2. **Protected Routes** - All endpoints except `/api/auth/signup` and `/api/auth/login` require authentication
3. **HTTPS in Production** - Always use HTTPS in production
4. **CORS Enabled** - Configured to allow requests from your frontend

---

## 🛠️ Troubleshooting

### QR Code Times Out
- Try again, QR codes expire after 60 seconds
- Check your internet connection

### Pairing Code Doesn't Work
- Verify phone number format (must be international without +)
- Code expires after 2 minutes, generate a new one
- Make sure WhatsApp is installed on the phone

### Bot Goes Offline
- Use `/api/session/restart` to reconnect
- Check server status with `/api/status`
- Review server logs for errors

---

## 📚 Full Documentation

For complete API reference with all parameters and responses, see **API.md**

For a working example of integrating with the API, see **example-frontend.html** - open it in your browser and test all features!

---

## ✨ Next Steps

1. **Test the API** - Use example-frontend.html or cURL commands above
2. **Integrate with Frontend** - Use the example code to build your dashboard
3. **Deploy to Production** - Configure HTTPS and secure your credentials
4. **Monitor Performance** - Use `/api/status` endpoint regularly

---

**Happy Botting! 🤖**
