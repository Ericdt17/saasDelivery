# 📱 WhatsApp Session - How It Works

## 🔐 What is a Session?

A **session** is like a "login token" that WhatsApp Web uses to remember your device. Once you scan the QR code, WhatsApp saves this session so you don't need to scan again.

## 💾 Where is the Session Saved?

The session is saved in the `./auth` folder:

```
wwebjs-bot/
  └── auth/
      └── session/
          └── [session files]
```

**Important:**

- ✅ The session persists even if you close the bot
- ✅ You only scan QR code ONCE (first time)
- ✅ Session stays valid until you manually disconnect from phone

## ⏱️ When Does the Session Stop?

The session can stop/disconnect in these situations:

### 1. **Manual Disconnection** (Most Common)

- You disconnect the device from your phone:
  - Open WhatsApp → Linked Devices → Tap "Log out" on the bot device
- **Result:** Session is deleted, need to scan QR again

### 2. **Network Issues**

- Internet connection drops
- WiFi disconnects
- Server/computer goes offline
- **Result:** Temporary disconnect, auto-reconnects when internet returns

### 3. **WhatsApp Server Issues**

- WhatsApp servers are down
- Maintenance/updates
- **Result:** Temporary disconnect, auto-reconnects

### 4. **Session Expired** (Rare)

- WhatsApp invalidates old sessions (security)
- Usually happens after weeks/months of inactivity
- **Result:** Need to scan QR code again

### 5. **Bot Crashes/Stops**

- Bot process stops/crashes
- Computer restarts
- **Result:** Session is saved, just restart the bot

## 🔄 How Reconnection Works

### ✅ **Session Still Valid** (Most Cases)

If the session is still valid:

1. Bot starts → Loads session from `./auth` folder
2. Connects automatically → No QR code needed
3. Ready to receive messages

### ❌ **Session Invalid/Deleted**

If session is invalid:

1. Bot starts → Tries to load session
2. Session not found/invalid → Shows QR code
3. You scan QR code → New session saved
4. Bot connects → Ready

## 🛠️ Current Bot Behavior

**Auto-Reconnect:**

- If disconnected, bot waits 5 seconds
- Automatically tries to reconnect
- If session is valid → Reconnects automatically
- If session invalid → Shows QR code

**Session Persistence:**

- Session saved in `./auth` folder
- Survives bot restarts
- Survives computer restarts
- Only deleted if you manually disconnect from phone

## 📋 How to Check Session Status

**When bot starts, look for:**

✅ **Session Valid:**

```
✅ AUTHENTICATED SUCCESSFULLY!
✅ Bot is ready!
```

❌ **Session Invalid:**

```
📱 HOW TO SCAN THE QR CODE:
[QR code appears]
```

## 🔧 Troubleshooting

### Problem: Bot keeps asking for QR code

**Solution:**

1. Check if device is still linked in WhatsApp (phone → Linked Devices)
2. If not linked → Scan QR code again
3. If linked but still asking → Delete `./auth` folder and restart

### Problem: Bot disconnects frequently

**Solution:**

1. Check internet connection
2. Check if WhatsApp is working on phone
3. Check terminal for error messages

### Problem: Want to use different WhatsApp account

**Solution:**

1. Stop the bot
2. Delete `./auth` folder
3. Restart bot → New QR code appears
4. Scan with new account

## 💡 Best Practices

1. **Keep bot running:** Don't stop it unless necessary
2. **Don't disconnect from phone:** Keep device linked in WhatsApp
3. **Stable internet:** Use reliable internet connection
4. **Monitor logs:** Watch terminal for disconnect messages
5. **Backup auth folder:** If important, backup `./auth` folder

## 🚨 Important Notes

- ⚠️ **One session per bot:** Each bot instance uses one session
- ⚠️ **Don't delete auth folder:** Unless you want to rescan QR
- ⚠️ **Phone must be online:** WhatsApp on phone must be connected
- ⚠️ **Linked device limit:** WhatsApp allows max 4 linked devices







