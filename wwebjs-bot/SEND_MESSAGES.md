# 📤 How to Send Messages via WhatsApp

## ⚠️ Important: Avoid Conflicts

**If your main bot is running**, don't use `npm run send` at the same time - it will cause a "Target closed" error because both try to use the same WhatsApp session.

**Solutions:**
1. **Stop the main bot first**, then use `npm run send`
2. **Or wait** - The bot can send daily reports automatically (see below)

---

## Finding Your Group ID

To send messages to a WhatsApp group, you need the **Group ID**. Here's how to find it:

### Method 1: From Bot Logs
1. Start the bot: `npm run dev`
2. Send any message in your WhatsApp group
3. Look in the terminal for: `groupId: 120363123456789012@g.us`
4. Copy that ID

### Method 2: From WhatsApp Web
1. Open the group in WhatsApp Web
2. Check the URL - the group ID is in the URL parameters

**Group ID Format:**
- Must end with `@g.us`
- Example: `120363123456789012@g.us`

---

## Sending Messages

### Option 1: Using Default Group (Easiest)

1. **Set GROUP_ID in `.env`:**
   ```env
   GROUP_ID=120363123456789012@g.us
   ```

2. **Send message:**
   ```bash
   npm run send "Hello from bot!"
   ```

### Option 2: Specify Group ID in Command

```bash
npm run send -- --group=120363123456789012@g.us "Hello from bot!"
```

### Option 3: Send to Individual Contact

```bash
npm run send -- --phone=612345678 "Hello!"
```

---

## Troubleshooting

### Error: "Could not send to group"

**Possible causes:**
1. ❌ **Group ID is incorrect**
   - Make sure it ends with `@g.us`
   - Check the ID from bot logs

2. ❌ **Bot is not a member of the group**
   - Add the WhatsApp number (that the bot uses) to the group
   - The bot must be a group member to send messages

3. ❌ **Group ID format wrong**
   - Correct: `120363123456789012@g.us`
   - Wrong: `YOUR_GROUP_ID` (this is a placeholder)

### Error: "Protocol error (Runtime.callFunctionOn): Target closed"

This means:
- ❌ **The main bot is already running** (most common cause)
- Both scripts are trying to use the same WhatsApp session

**Solution:**
1. **Stop the main bot** (Ctrl+C in the terminal where it's running)
2. **Then** run `npm run send`
3. **Or** use automatic daily reports instead (see below)

### Error: "Evaluation failed"

This usually means:
- Group ID doesn't exist or is invalid
- Bot doesn't have permission to send messages
- WhatsApp session needs to be refreshed

**Solution:**
- Make sure main bot is stopped first
- Restart and re-authenticate if needed
- Verify group ID is correct

---

## Examples

### Send to Group (using config)
```bash
# Set in .env first: GROUP_ID=120363123456789012@g.us
npm run send "Daily summary: 10 deliveries today!"
```

### Send to Group (direct)
```bash
npm run send -- --group=120363123456789012@g.us "Reminder: Check pending deliveries"
```

### Send to Contact
```bash
npm run send -- --phone=612345678 "Delivery #123 is ready!"
```

---

## Automatic Messages

The bot can automatically send:
- ✅ Daily reports (set `REPORT_SEND_TO_GROUP=true` in `.env`)
- ✅ Delivery confirmations (set `SEND_CONFIRMATIONS=true` in `.env`)

---

## Notes

- Messages are sent from the WhatsApp account connected to the bot
- The bot must be a member of the group to send messages
- Group IDs are unique and permanent
- Make sure your `.env` file has the correct `GROUP_ID` format

