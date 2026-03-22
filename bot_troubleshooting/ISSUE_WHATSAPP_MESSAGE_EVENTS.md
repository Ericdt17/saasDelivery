# ISSUE: WhatsApp bot not firing message events (message/message_create)
## Summary
Your WhatsApp bot would connect (“CONNECTED”) and register listeners, but no incoming events were processed (no `MESSAGE EVENT FIRED` / `MESSAGE_CREATE EVENT FIRED`). After troubleshooting, the effective resolution was:
1) updating/pinning `whatsapp-web.js` to the `#main` branch (known working commit), and
2) ensuring there was only one running bot instance using the LocalAuth session (avoiding browser/session locks).
## Symptoms
- Bot console shows WhatsApp client connected, but sending `#link` / `hello` results in:
  - no `🔔 MESSAGE EVENT FIRED...` logs
  - no `🔔 MESSAGE_CREATE EVENT FIRED...` logs
- Additional startup errors seen during troubleshooting:
  - `The browser is already running for .../.wwebjs_auth/session-delivery-bot-default`
  - Puppeteer Chrome not found (during earlier attempts)
## Root cause(s)
sion/browser lock (LocalAuth)**  
   Multiple `wwebjs-bot` processes using the same LocalAuth session directory prevented proper browser startup and event delivery.
2) **Library/session behavior**  
   The issue persisted until `whatsapp-web.js` was pinned to a known-working state from `#main`.
## Fix applied
### 1. Pin `whatsapp-web.js` to `#main`
- `wwebjs-bot/package.json` dependency:
  - `whatsapp-web.js`: `github:pedroslopez/whatsapp-web.js#main`
- Verified via:
  - `npm ls whatsapp-web.js`
  - Resolved commit:
    - `b0e869317f301f3bd20dea20cdcbb08e452d8f36`
- `wwebjs-bot/package-lock.json` updated accordingly.
### 2. Clean auth + avoid multiple instances
- Deleted LocalAuth session folder to force a fresh login:
  - `wwebjs-bot/.wwebjs_auth/`
- Restarted and ensured only **one** bot instance was running for the same `CLIENT_ID`.
### 3. Puppeteer/Chrome (when applicable)
During early attempts, Puppeteer failed to launch due to missing Chrome. After installing a working Chrome and restarting, the bot was able to proceed.
## Verification checklist
1) Start bot and confirm it reaches:
   - `✅ AUTHENTICATED SUCCESSFULLY!` and/or `State: CONNECTED`
2) Send `hello` in a private 1:1 chat to the bot:
   - expect `🔔 MESSAGE EVENT FIRED - ...` and/or `🔔 MESSAGE_CREATE EVENT FIRED - ...`
3) In a group where the bot is present, send `#link`:
   - expect the `#link command detected` flow and bot response.
## Notes
- Always stop old bot terminals before restarting to avoid LocalAuth lock errors.
- If message events stop again, first check:
  - duplicate running bot instances
  - LocalAuth session state
  - installed/present Chrome for Puppeteer
