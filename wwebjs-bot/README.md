# WhatsApp Delivery Bot - Phase 1

## Setup Complete! ✅

Phase 1 is ready. The bot can now connect to WhatsApp and log all messages.

## How to Run

1. **Create `.env` file** (if it doesn't exist):
   ```
   GROUP_NAME=
   GROUP_ID=
   TZ=Africa/Douala
   REPORT_TIME=20:00
   DB_PATH=./data/bot.db
   ```

2. **Start the bot**:
   ```bash
   npm start
   ```

3. **Scan QR Code**: 
   - A QR code will appear in your terminal
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices → Link a Device
   - Scan the QR code

4. **Find Your Group ID**:
   - Once connected, the bot will log all messages
   - Look for messages from your target group
   - Copy the "Group ID" from the logs
   - Add it to your `.env` file: `GROUP_ID=your-group-id-here`

## What This Phase Does

- ✅ Connects to WhatsApp
- ✅ Shows QR code for authentication
- ✅ Saves session (no need to scan QR every time)
- ✅ Logs all incoming messages
- ✅ Shows group names and IDs (so you can find your target group)

## Next Steps (Phase 2)

After you find your group ID and add it to `.env`, we'll:
- Filter messages to only handle your target group
- Set up the database
- Start parsing delivery messages





