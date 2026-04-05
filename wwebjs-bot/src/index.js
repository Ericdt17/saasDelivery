const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const {
  isDeliveryMessage,
  parseDeliveryMessage,
  looksLikeMalformedDelivery,
  getFormatReminderMessage,
} = require("./parser");
const { parseStatusUpdate, isStatusUpdate } = require("./statusParser");
const {
  createDelivery,
  findDeliveryByPhoneForUpdate,
  findDeliveryByMessageId,
  updateDelivery,
  addHistory,
  getTariffByAgencyAndQuartier,
} = require("./db");
const { createRemindersWorker } = require("./reminders/worker");
const { generateDailyReport } = require("./daily-report");
const { getGroup, getAgencyIdForGroup } = require("./utils/group-manager");
const {
  computeAmountPaidAfterFee,
  roundAmount,
} = require("./lib/deliveryCalculations");
const botAlerts = require("./lib/botAlerts");

/** groupId:author → last format-reminder sent (ms) */
const formatReminderCooldownByKey = new Map();

// Log startup time
const startupStartTime = Date.now();
console.log("⏳ Initializing bot components...");

// Log environment info for debugging
console.log("\n" + "=".repeat(60));
console.log("🔧 BOT ENVIRONMENT CONFIGURATION");
console.log("=".repeat(60));
console.log(`   NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(
  `   CLIENT_ID: ${process.env.CLIENT_ID || "delivery-bot-default (default)"}`
);
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const maskedUrl = `${dbUrl.protocol}//${dbUrl.username}:***@${dbUrl.hostname}${dbUrl.pathname}`;
    console.log(`   DATABASE_URL: ${maskedUrl}`);
  } catch (e) {
    console.log(`   DATABASE_URL: *** (present but invalid format)`);
  }
} else {
  console.log(`   DATABASE_URL: NOT SET (required — set DATABASE_URL)`);
}
console.log("=".repeat(60) + "\n");

// Create WhatsApp client with local auth (saves session)
// Using clientId for environment isolation (prod/staging/dev)
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.CLIENT_ID || "delivery-bot-default",
  }),
  puppeteer: {
    headless: true,
    // Use bundled Chromium from puppeteer (whatsapp-web.js dependency) unless you
    // override with PUPPETEER_EXECUTABLE_PATH (e.g. system Chrome on a server).
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      // Additional Windows-specific fixes
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
    // Optimize startup
    timeout: 120000, // 120 seconds timeout for browser launch
    // Ignore default args that might cause issues
    ignoreDefaultArgs: ["--disable-extensions"],
  },
  // Add restart on failure
  restartOnAuthFail: true,
  // Add web version cache
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html",
  },
});

// Show QR code in terminal when authentication needed
let qrShown = false;
botAlerts.init({ getQrShown: () => qrShown, client });

client.on("qr", async (qr) => {
  if (!qrShown) {
    console.log("\n" + "=".repeat(60));
    console.log("📱 HOW TO SCAN THE QR CODE:");
    console.log("=".repeat(60));
    console.log("1. Open WhatsApp on your PHONE (not computer)");
    console.log("2. Tap the 3 dots menu (☰) → Linked Devices");
    console.log("3. Tap 'Link a Device'");
    console.log("4. Point your phone camera at the QR code below");
    console.log("   OR open the qr-code.png file and scan it");
    console.log("=".repeat(60));
    console.log(
      "⚠️  QR code expires in 20 seconds. If it refreshes, scan the NEWEST one.\n"
    );
    qrShown = true;
    botAlerts.onQrShown();
  } else {
    console.log("\n⚠️  QR code refreshed! Scan the NEWEST QR code below:");
    console.log("   (Open WhatsApp → Linked Devices → Link a Device)\n");
    botAlerts.onQrShown();
  }

  // Show medium-sized QR code in terminal (may be distorted in Render logs)
  qrcode.generate(qr, { small: true });

  // Also save as image file and generate data URL for remote access
  try {
    const qrImagePath = path.join(__dirname, "..", "qr-code.png");
    await QRCode.toFile(qrImagePath, qr, {
      width: 400, // Increased size for better scanning
      margin: 2,
    });
    console.log("\n💡 QR code saved as: qr-code.png");

    // Generate base64 data URL for Render/remote access
    const qrDataUrl = await QRCode.toDataURL(qr, {
      width: 400,
      margin: 2,
    });

    // For Render: Output QR code in multiple formats for easier access
    console.log("\n🌐 QR CODE FOR REMOTE ACCESS (Render/Cloud):");
    console.log("=".repeat(80));
    console.log("\n📋 Option 1: Use online QR code generator");
    console.log("   Visit: https://www.qr-code-generator.com/");
    console.log("   Or: https://qr.io/");
    console.log("   Paste this QR code data:");
    console.log("   " + qr);
    console.log("\n📋 Option 2: Use base64 data URL (long, but works)");
    console.log(
      "   Copy the ENTIRE line below and paste in browser address bar:"
    );
    console.log(
      "   (It's very long - use 'Copy All' from Render logs if possible)"
    );
    console.log(
      qrDataUrl.substring(0, 200) + "... [truncated, see full URL in logs]"
    );
    console.log("\n📋 Option 3: Use the QR code terminal output above");
    console.log(
      "   (May be distorted in Render logs - try options 1 or 2 instead)"
    );
    console.log("=".repeat(80) + "\n");
  } catch (err) {
    console.log(
      "   (Could not save QR code image, but terminal QR code should work)\n"
    );
    console.log("   Raw QR data:", qr);
    console.log(
      "   Use this with an online QR code generator: https://www.qr-code-generator.com/\n"
    );
  }
});

// When client is ready
let remindersWorker = null;
client.on("ready", () => {
  botAlerts.notifyReady();
  const startupDuration = ((Date.now() - startupStartTime) / 1000).toFixed(1);
  botAlerts.notifyStartup(startupDuration);
  console.log("\n" + "=".repeat(60));
  console.log("✅ BOT IS READY!");
  console.log("=".repeat(60));
  console.log(`⏱️  Startup time: ${startupDuration} seconds`);
  console.log("📋 Listening for messages...");

  // Verify message event listener is registered
  const listeners = client.listenerCount("message");
  console.log(`📊 Message event listeners: ${listeners}`);

  if (listeners === 0) {
    console.error("❌ WARNING: No message event listeners found!");
    console.error("   This means the bot won't receive messages.");
  } else {
    console.log("✅ Message event listener is registered");
  }

  console.log("=".repeat(60) + "\n");
  qrShown = false; // Reset for next time

  // Setup daily report scheduler
  setupDailyReportScheduler();

  // Start reminders worker (scheduled WhatsApp reminders)
  if (!remindersWorker) {
    remindersWorker = createRemindersWorker({
      client,
      pollIntervalMs: Number(process.env.REMINDERS_POLL_MS) || 60000,
      batchSize: Number(process.env.REMINDERS_BATCH_SIZE) || 50,
      logger: console,
    });
    remindersWorker.start();
  }
});

// Additional check: Sometimes ready event doesn't fire, check state manually
client.on("authenticated", async () => {
  console.log("\n" + "=".repeat(60));
  console.log("✅ AUTHENTICATED SUCCESSFULLY!");
  console.log("✅ Session saved!");
  console.log("💡 You won't need to scan QR code again next time.");
  console.log("=".repeat(60) + "\n");

  // Wait a bit then check if client is ready (in case ready event doesn't fire)
  setTimeout(async () => {
    try {
      const state = await client.getState();
      console.log(
        `\n🔍 DIAGNOSTIC: Checking client state after authentication...`
      );
      console.log(`   State: ${state}`);

      if (state === "CONNECTED") {
        botAlerts.notifyReady();
        console.log("\n" + "=".repeat(60));
        console.log("✅ CLIENT STATE: CONNECTED");
        console.log("=".repeat(60));
        console.log("📋 Bot should be listening for messages now.");

        // Verify message event listener is registered
        const listeners = client.listenerCount("message");
        console.log(`📊 Message event listeners: ${listeners}`);

        if (listeners === 0) {
          console.error("❌ WARNING: No message event listeners found!");
          console.error("   This means the bot won't receive messages.");
        } else {
          console.log("✅ Message event listener is registered");
        }

        // Setup daily report scheduler if ready event didn't fire
        if (typeof setupDailyReportScheduler === "function") {
          console.log("📅 Setting up daily report scheduler...");
          setupDailyReportScheduler();
        }

        // Start reminders worker if ready event didn't fire
        if (!remindersWorker) {
          remindersWorker = createRemindersWorker({
            client,
            pollIntervalMs: Number(process.env.REMINDERS_POLL_MS) || 60000,
            batchSize: Number(process.env.REMINDERS_BATCH_SIZE) || 50,
            logger: console,
          });
          remindersWorker.start();
        }

        console.log(
          "\n💡 Test: Send a message in the group and check for 'MESSAGE EVENT FIRED'\n"
        );
        console.log("=".repeat(60) + "\n");
      } else {
        console.log(`\n⚠️  Client state: ${state}`);
        console.log("💡 Waiting for ready event or CONNECTED state...\n");
      }
    } catch (error) {
      console.error("⚠️  Error checking client state:", error.message);
      console.error("   Stack:", error.stack);
    }
  }, 3000); // Check after 3 seconds (reduced from 5)
});

// When authentication fails
client.on("auth_failure", (msg) => {
  botAlerts.notifyAuthFailure(msg);
  console.error("\n" + "=".repeat(60));
  console.error("❌ AUTHENTICATION FAILED!");
  console.error("Error:", msg);
  console.error("=".repeat(60) + "\n");
});

// When client is disconnected
client.on("disconnected", (reason) => {
  botAlerts.notifyDisconnected(reason);
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  CLIENT DISCONNECTED");
  console.log("=".repeat(60));
  console.log("Reason:", reason);
  console.log("\n💡 The session is saved in ./auth folder");
  console.log("🔄 Attempting to reconnect...\n");

  // Auto-reconnect after 5 seconds
  setTimeout(() => {
    console.log("🔄 Reconnecting...");
    client.initialize();
  }, 5000);
});

// Listen to all incoming messages
console.log("📋 Registering message event listener...");
console.log("🔍 Listening for 'message' events");

client.on("message", async (msg) => {
  try {
    console.log("🔔 MESSAGE EVENT FIRED - Bot received a message!");

    // Skip messages from the bot itself (to avoid loops)
    if (msg.fromMe) {
      console.log("   ⏭️  Skipped: Message from bot itself\n");
      return;
    }

    const chat = await msg.getChat();
    const messageText = msg.body || "";

    // DEBUG: Log ALL messages first to see what's coming in
    console.log("\n🔍 DEBUG - Raw message received:");
    console.log("   isGroup:", chat.isGroup);
    console.log("   groupId:", chat.id?._serialized || "N/A");
    console.log("   targetGroupId:", config.GROUP_ID);
    console.log("   message length:", messageText.length);
    console.log("   message preview:", messageText.substring(0, 150));

    // Only process messages from groups
    if (!chat.isGroup) {
      console.log("   ⏭️  Skipped: Not a group message\n");
      return; // Skip private messages
    }

    const whatsappGroupId = chat.id._serialized;
    const groupName = chat.name || "Unnamed Group";
    const targetGroupId = config.GROUP_ID;

    // Handle #link command - works even for unregistered groups
    // Check if message is exactly "#link" (case-insensitive, with optional whitespace)
    const trimmedMessage = messageText.trim();
    if (trimmedMessage.toLowerCase() === "#link") {
      console.log("   🔗 #link command detected - sending group ID");

      const messageTextToSend =
        `📋 ID du groupe WhatsApp:\n\n` +
        `\`${whatsappGroupId}\`\n\n` +
        `💡 Copiez cet ID et collez-le dans votre tableau de bord pour lier ce groupe à votre agence.\n\n` +
        `📝 Nom du groupe: ${groupName}`;

      let messageSent = false;
      let sentMessage = null;
      let lastError = null;

      // Method 1: Patch sendSeen() temporarily to bypass markedUnread error
      console.log("   🔄 Attempting to send with sendSeen() patch...");
      try {
        const page = client.pupPage;
        if (page && !page.isClosed()) {
          // Patch sendSeen() to be a no-op temporarily
          await page.evaluate(() => {
            if (window.WWebJS && window.WWebJS.sendSeen) {
              // Save original
              window._originalSendSeen = window.WWebJS.sendSeen;
              // Replace with no-op
              window.WWebJS.sendSeen = async function () {
                // Do nothing - this prevents markedUnread error
                return Promise.resolve();
              };
            }
          });

          try {
            // Now try sending - sendSeen() won't fail
            sentMessage = await client.sendMessage(
              whatsappGroupId,
              messageTextToSend
            );
            messageSent = true;
            console.log(
              `   ✅ Group ID sent successfully with sendSeen patch: ${whatsappGroupId}`
            );
            if (sentMessage?.id) {
              console.log(
                `   📱 Message ID: ${sentMessage.id._serialized || sentMessage.id}`
              );
            }
          } finally {
            // Restore original sendSeen() after sending
            await page.evaluate(() => {
              if (window._originalSendSeen) {
                window.WWebJS.sendSeen = window._originalSendSeen;
                delete window._originalSendSeen;
              }
            });
          }
        } else {
          throw new Error("Puppeteer page not available");
        }
      } catch (patchErr) {
        lastError = patchErr;
        console.log(`   ⚠️  Patch method failed: ${patchErr.message}`);
        console.log(`   🔄 Trying alternative approach...`);

        // Method 2: Use WWebJS.sendMessage directly via Puppeteer
        try {
          const page = client.pupPage;
          if (page && !page.isClosed()) {
            const result = await page.evaluate(
              async (groupId, text) => {
                try {
                  // Use WWebJS.sendMessage which might bypass some checks
                  if (window.WWebJS && window.WWebJS.sendMessage) {
                    const result = await window.WWebJS.sendMessage(
                      groupId,
                      text
                    );
                    return {
                      success: true,
                      messageId: result?.id?._serialized || result?.id || null,
                    };
                  }
                  throw new Error("WWebJS.sendMessage not available");
                } catch (err) {
                  return {
                    success: false,
                    error: err.message,
                  };
                }
              },
              whatsappGroupId,
              messageTextToSend
            );

            if (result.success) {
              messageSent = true;
              console.log(
                `   ✅ Group ID sent via WWebJS.sendMessage: ${whatsappGroupId}`
              );
              if (result.messageId) {
                console.log(`   📱 Message ID: ${result.messageId}`);
              }
              // Verify after delay
              await new Promise((resolve) => setTimeout(resolve, 2000));
              try {
                const verifyChat = await client.getChatById(whatsappGroupId);
                const recentMessages = await verifyChat.fetchMessages({
                  limit: 5,
                });
                const ourMessage = recentMessages.find(
                  (m) =>
                    m.fromMe &&
                    m.body &&
                    m.body.includes("ID du groupe WhatsApp")
                );
                if (ourMessage) {
                  sentMessage = ourMessage;
                  console.log(`   ✅ Verified: Message confirmed in chat!`);
                }
              } catch (verifyErr) {
                console.log(`   ⚠️  Could not verify, but message was sent`);
              }
            } else {
              throw new Error(result.error || "WWebJS send failed");
            }
          } else {
            throw new Error("Puppeteer page not available");
          }
        } catch (wwebjsErr) {
          lastError = wwebjsErr;
          console.log(`   ⚠️  WWebJS method failed: ${wwebjsErr.message}`);

          // Method 3: Last resort - try standard method but catch and ignore markedUnread
          console.log(
            `   🔄 Trying standard method (will ignore markedUnread error)...`
          );
          try {
            const sendPromise = client.sendMessage(
              whatsappGroupId,
              messageTextToSend
            );
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Send timeout after 15s")),
                15000
              )
            );

            sentMessage = await Promise.race([sendPromise, timeoutPromise]);
            messageSent = true;
            console.log(
              `   ✅ Group ID sent (error suppressed): ${whatsappGroupId}`
            );
          } catch (stdErr) {
            const isMarkedUnread =
              stdErr.message?.includes("markedUnread") ||
              stdErr.stack?.includes("markedUnread");

            if (isMarkedUnread) {
              // Even though markedUnread error occurs, wait and verify if message was sent
              console.log(
                `   ⚠️  markedUnread error occurred, verifying if message was sent...`
              );
              await new Promise((resolve) => setTimeout(resolve, 3000));

              try {
                const verifyChat = await client.getChatById(whatsappGroupId);
                const recentMessages = await verifyChat.fetchMessages({
                  limit: 10,
                });
                const ourMessage = recentMessages.find(
                  (m) =>
                    m.fromMe &&
                    m.body &&
                    m.body.includes("ID du groupe WhatsApp")
                );

                if (ourMessage) {
                  sentMessage = ourMessage;
                  messageSent = true;
                  console.log(`   ✅ Message was sent despite error!`);
                  console.log(
                    `   📱 Message ID: ${ourMessage.id._serialized || "N/A"}`
                  );
                } else {
                  throw new Error("Message verification failed");
                }
              } catch (verifyErr) {
                lastError = verifyErr;
                console.error(
                  `   ❌ Message was not sent - verification failed`
                );
              }
            } else {
              lastError = stdErr;
              console.error(`   ❌ Standard method failed: ${stdErr.message}`);
            }
          }
        }
      }

      // Final result
      if (messageSent && sentMessage) {
        console.log(`   ✅ Group ID message sent and confirmed!`);
      } else if (messageSent) {
        console.log(
          `   ⚠️  Message sending attempted - please verify manually`
        );
      } else {
        console.error(`   ❌ Failed to send group ID message`);
        console.error(
          `   Last error: ${lastError?.message || "Unknown error"}`
        );
        console.error(`   💡 Troubleshooting:`);
        console.error(`      1. Check bot permissions in the group`);
        console.error(
          `      2. Try removing and re-adding the bot to the group`
        );
        console.error(`      3. Restart the bot to refresh the session`);
        console.error(
          `      4. Check if GROUP_ID in .env matches the group ID`
        );
      }

      return; // Stop processing after sending group ID
    }

    // Filter: Only handle messages from the configured group (if GROUP_ID is set)
    // If GROUP_ID is not set (null), process messages from all groups
    if (targetGroupId && whatsappGroupId !== targetGroupId) {
      console.log("   ⏭️  Skipped: Different group (GROUP_ID is configured)\n");
      console.log(
        "   💡 Tip: Remove GROUP_ID from .env to process all groups\n"
      );
      return; // Skip messages from other groups
    }

    console.log("   ✅ Processing: Group message detected!\n");

    // Initialize variables for group and agency
    let group = null;
    let agencyId = null;

    // Check if this is a reply to a previous message
    let quotedMessage = null;
    let deliveryFromReply = null;
    try {
      if (msg.hasQuotedMsg) {
        quotedMessage = await msg.getQuotedMessage();
        console.log("   💬 This is a REPLY to a previous message");

        // Try different ID formats
        const quotedIdSerialized = quotedMessage.id?._serialized;
        const quotedIdRemote = quotedMessage.id?.remote;
        const quotedIdId = quotedMessage.id?.id;

        console.log(
          `   📎 Quoted message ID (_serialized): ${quotedIdSerialized}`
        );
        console.log(`   📎 Quoted message ID (remote): ${quotedIdRemote}`);
        console.log(`   📎 Quoted message ID (id): ${quotedIdId}`);
        console.log(
          `   📎 Full quoted message ID object:`,
          JSON.stringify(quotedMessage.id, null, 2)
        );

        // Try to find delivery by quoted message ID (try multiple formats)
        if (quotedIdSerialized) {
          console.log(
            `   🔍 Searching for delivery with ID: ${quotedIdSerialized}`
          );
          deliveryFromReply = await findDeliveryByMessageId(quotedIdSerialized);
        }

        // If not found, try with remote ID
        if (!deliveryFromReply && quotedIdRemote) {
          console.log(
            `   🔍 Searching for delivery with remote ID: ${quotedIdRemote}`
          );
          deliveryFromReply = await findDeliveryByMessageId(quotedIdRemote);
        }

        // If not found, try with id
        if (!deliveryFromReply && quotedIdId) {
          console.log(`   🔍 Searching for delivery with id: ${quotedIdId}`);
          deliveryFromReply = await findDeliveryByMessageId(quotedIdId);
        }

        // Try to extract ID from the quoted message body or other properties
        if (!deliveryFromReply && quotedMessage) {
          // Sometimes the ID might be in a different format, try to extract from _serialized
          const serializedParts = quotedIdSerialized?.split("_");
          if (serializedParts && serializedParts.length > 0) {
            // Try with just the last part (the actual message ID)
            const lastPart = serializedParts[serializedParts.length - 1];
            console.log(`   🔍 Trying with extracted ID part: ${lastPart}`);
            deliveryFromReply = await findDeliveryByMessageId(lastPart);
          }
        }

        if (deliveryFromReply) {
          console.log(
            `   ✅ Found delivery #${deliveryFromReply.id} linked to quoted message`
          );
        } else {
          console.log(`   ⚠️  No delivery found for quoted message ID`);
          console.log(
            `   💡 The original delivery message might not have been stored with message ID`
          );
        }
      }
    } catch (replyError) {
      // Not a reply or error getting quoted message, continue normally
      console.log("   ℹ️  Not a reply or couldn't get quoted message");
      console.log(`   ⚠️  Error details: ${replyError.message}`);
    }

    // Check if group is registered in database
    // Only process messages from registered groups
    try {
      group = await getGroup(whatsappGroupId);

      if (!group) {
        // Group not registered - ignore message silently
        console.log(`   ⏭️  Skipped: Group not registered in database`);
        console.log(
          `   💡 Tip: Add this group via the dashboard to start processing messages`
        );
        return; // Stop processing - group not registered
      }

      // Group is registered - continue processing
      agencyId = group.agency_id;
      console.log(
        `   📋 Group: ${group.name} (DB ID: ${group.id}, Agency: ${agencyId})`
      );
    } catch (groupError) {
      console.error(`   ⚠️  Error checking group: ${groupError.message}`);
      // If error checking group, skip processing to avoid errors
      return;
    }

    // Safely get contact info (may fail due to WhatsApp Web changes)
    let contactName = "Unknown";
    let contactNumber = msg.from || "Unknown";

    try {
      const contact = await msg.getContact();
      contactName = contact.pushname || contact.name || contactNumber;
      contactNumber = contact.number || msg.from || "Unknown";
    } catch (contactError) {
      // If contact retrieval fails, use message info directly
      contactName = msg.notifyName || msg.from || "Unknown";
      contactNumber = msg.from || "Unknown";
    }

    // Log messages from target group
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 Message from Target Group:");
    console.log("   Group Name:", chat.name);
    console.log("   From:", contactName);
    console.log("   Full Message:", messageText);
    console.log("   Message Length:", messageText.length);

    // FIRST: Check if this is a STATUS UPDATE (priority over new deliveries)
    // If it's a reply, try to use the delivery from the reply first
    const isStatus = isStatusUpdate(messageText) || deliveryFromReply;
    if (isStatus) {
      console.log("   🔄 Detected as STATUS UPDATE");

      // If it's a reply to a delivery message, use that delivery
      let delivery = deliveryFromReply;

      // Otherwise, parse status update and find by phone
      let statusData = null;
      if (!delivery) {
        statusData = parseStatusUpdate(messageText);
        console.log("   📊 Status data:", JSON.stringify(statusData, null, 2));

        // Find the delivery to update (use ForUpdate to find any delivery regardless of status)
        if (statusData && statusData.phone) {
          delivery = await findDeliveryByPhoneForUpdate(statusData.phone);
        }
      } else {
        // It's a reply, parse status update without requiring phone number
        statusData = parseStatusUpdate(messageText, true); // true = isReply, don't require phone
        console.log(
          "   📊 Status data from reply:",
          JSON.stringify(statusData, null, 2)
        );
      }

      // Helper function to apply tariff logic for status updates
      const applyTariffForStatusUpdate = async (
        delivery,
        updateData,
        agencyId,
        forceAmountPaidToZero = false
      ) => {
        // Only apply tariff if agency_id and quartier are available
        if (!agencyId || !delivery.quartier) {
          console.log(
            `   ⚠️  Cannot apply tariff: agency_id or quartier missing`
          );
          return;
        }

        // Check if delivery_fee is already set (manual fee)
        const currentDeliveryFee = delivery.delivery_fee || 0;

        if (currentDeliveryFee > 0) {
          // Tariff already applied, just proceed
          if (forceAmountPaidToZero) {
            updateData.amount_paid = 0;
            console.log(
              `   💰 Tariff already applied (${currentDeliveryFee}), amount_paid forced to 0 (client_absent)`
            );
          } else {
            console.log(`   💰 Tariff already applied (${currentDeliveryFee})`);
          }
          return;
        }

        // Apply automatic tariff
        try {
          const tariffResult = await getTariffByAgencyAndQuartier(
            agencyId,
            delivery.quartier
          );
          const tariff = Array.isArray(tariffResult)
            ? tariffResult[0]
            : tariffResult;

          if (!tariff || !tariff.tarif_amount) {
            console.log(
              `   ⚠️  No tariff found for quartier "${delivery.quartier}", status change allowed without tariff`
            );
            if (forceAmountPaidToZero) {
              updateData.amount_paid = 0;
            }
            return;
          }

          const tariffAmount = parseFloat(tariff.tarif_amount) || 0;
          updateData.delivery_fee = tariffAmount;

          if (forceAmountPaidToZero) {
            // For client_absent: apply tariff but force amount_paid = 0
            updateData.amount_paid = 0;
            console.log(
              `   💰 Applied automatic tariff: ${tariffAmount} FCFA for quartier "${delivery.quartier}", amount_paid forced to 0 (client_absent)`
            );
          } else {
            // For delivered: apply tariff and calculate amount_paid
            const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
            const newAmountPaid = computeAmountPaidAfterFee(
              currentAmountPaid,
              tariffAmount
            );
            updateData.amount_paid = newAmountPaid;
            console.log(
              `   💰 Applied automatic tariff: ${tariffAmount} FCFA for quartier "${delivery.quartier}"`
            );
            console.log(
              `   💵 Amount paid: ${currentAmountPaid} -> ${newAmountPaid} FCFA`
            );
          }
        } catch (tariffError) {
          console.error(`   ❌ Error applying tariff: ${tariffError.message}`);
          if (forceAmountPaidToZero) {
            updateData.amount_paid = 0;
          }
        }
      };

      // Only proceed if we have a delivery and status data
      if (delivery && statusData) {
        try {
          let updateData = {};
          let historyAction = "";

          switch (statusData.type) {
            case "delivered":
              updateData.status = "delivered";
              historyAction = "marked_delivered";
              console.log(
                `   ✅ Livraison #${delivery.id} marquée comme LIVRÉE`
              );

              // Apply tariff logic for "delivered"
              await applyTariffForStatusUpdate(
                delivery,
                updateData,
                agencyId,
                false
              );
              break;

            case "client_absent":
              updateData.status = "client_absent";
              historyAction = "marked_client_absent";
              console.log(
                `   ⚠️  Livraison #${delivery.id} marquée comme CLIENT ABSENT`
              );

              // Apply tariff logic for "client_absent" (tariff applied, amount_paid = 0)
              await applyTariffForStatusUpdate(
                delivery,
                updateData,
                agencyId,
                true
              );
              break;

            case "failed":
              updateData.status = "failed";
              historyAction = "marked_failed";
              console.log(
                `   ❌ Livraison #${delivery.id} marquée comme ÉCHEC`
              );
              // Annuler le tarif et rembourser le montant si reçu
              updateData.delivery_fee = 0;
              const currentAmountPaidFailed =
                parseFloat(delivery.amount_paid) || 0;
              if (currentAmountPaidFailed > 0) {
                updateData.amount_paid = 0;
                console.log(
                  `   💰 Remboursement de ${currentAmountPaidFailed} F (amount_paid mis à 0)`
                );
              }
              console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
              break;

            case "postponed":
              updateData.status = "postponed";
              historyAction = "marked_postponed";
              console.log(
                `   🔄 Livraison #${delivery.id} marquée comme RENVOYÉE`
              );
              // Annuler le tarif et rembourser le montant si reçu (même logique que failed)
              updateData.delivery_fee = 0;
              const currentAmountPaidPostponed =
                parseFloat(delivery.amount_paid) || 0;
              if (currentAmountPaidPostponed > 0) {
                updateData.amount_paid = 0;
                console.log(
                  `   💰 Remboursement de ${currentAmountPaidPostponed} F (amount_paid mis à 0)`
                );
              }
              console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
              break;

            case "payment":
              // If amount is not specified, use the remaining amount due
              // Convert to numbers to handle PostgreSQL DECIMAL types (returned as strings)
              // Round to 2 decimal places to avoid floating point precision issues
              const currentAmountPaid = roundAmount(
                parseFloat(delivery.amount_paid) || 0
              );
              const currentAmountDue = roundAmount(
                parseFloat(delivery.amount_due) || 0
              );

              let paymentAmount = roundAmount(
                parseFloat(statusData.amount) || 0
              );
              if (!paymentAmount || paymentAmount === 0) {
                const remainingAmount = currentAmountDue - currentAmountPaid;
                paymentAmount =
                  remainingAmount > 0 ? remainingAmount : currentAmountDue;
                paymentAmount = roundAmount(paymentAmount);
                console.log(
                  `   💡 Montant non spécifié, utilisation du montant restant: ${paymentAmount} FCFA`
                );
              }

              const newAmountPaid = roundAmount(
                currentAmountPaid + paymentAmount
              );
              updateData.amount_paid = newAmountPaid;
              historyAction = "payment_collected";
              console.log(`   💰 Paiement collecté: ${paymentAmount} FCFA`);
              console.log(
                `   💵 Total payé: ${newAmountPaid} FCFA / ${currentAmountDue} FCFA`
              );

              // Auto-mark as delivered if fully paid (apply tariff logic)
              if (newAmountPaid >= currentAmountDue) {
                updateData.status = "delivered";
                console.log(
                  `   ✅ Livraison complètement payée - marquée comme LIVRÉE`
                );
                // Apply tariff logic for "delivered" status
                await applyTariffForStatusUpdate(
                  delivery,
                  updateData,
                  agencyId,
                  false
                );
              }
              break;

            case "pickup":
              updateData.status = "pickup";
              historyAction = "marked_pickup";
              console.log(
                `   📦 Livraison #${delivery.id} marquée comme AU BUREAU`
              );

              // Apply fixed tariff of 1000 FCFA for pickup (Au bureau)
              // Modify amount_paid like "delivered": amount_paid = amount_due - delivery_fee
              const pickupTariff = 1000;

              // Check if delivery_fee is already set
              const currentDeliveryFeePickup = delivery.delivery_fee || 0;

              if (currentDeliveryFeePickup > 0) {
                // Tariff already applied, keep it
                updateData.delivery_fee = currentDeliveryFeePickup;
                console.log(
                  `   💰 Tariff already applied (${currentDeliveryFeePickup})`
                );
              } else {
                // Apply fixed pickup tariff
                updateData.delivery_fee = pickupTariff;

                // Calculate amount_paid (same logic as delivered)
                const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
                const currentAmountDue = parseFloat(delivery.amount_due) || 0;

                if (currentAmountPaid === 0 && currentAmountDue > 0) {
                  // No payment recorded yet, assume full payment was made
                  const newAmountPaid = computeAmountPaidAfterFee(
                    currentAmountDue,
                    pickupTariff
                  );
                  updateData.amount_paid = newAmountPaid;
                  console.log(
                    `   💰 Applied fixed pickup tariff: ${pickupTariff} FCFA (Au bureau)`
                  );
                  console.log(
                    `   💵 No payment recorded, assuming full payment: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${pickupTariff})`
                  );
                } else if (
                  currentAmountPaid > 0 &&
                  currentAmountPaid < currentAmountDue
                ) {
                  // Partial payment: subtract tariff from current amount_paid
                  const newAmountPaid = computeAmountPaidAfterFee(
                    currentAmountPaid,
                    pickupTariff
                  );
                  updateData.amount_paid = newAmountPaid;
                  console.log(
                    `   💰 Applied fixed pickup tariff: ${pickupTariff} FCFA (Au bureau)`
                  );
                  console.log(
                    `   💵 Partial payment: ${currentAmountPaid} -> ${newAmountPaid}`
                  );
                } else if (
                  currentAmountPaid >= currentAmountDue &&
                  currentAmountDue > 0
                ) {
                  // Full payment already recorded: recalculate with tariff
                  const newAmountPaid = computeAmountPaidAfterFee(
                    currentAmountDue,
                    pickupTariff
                  );
                  updateData.amount_paid = newAmountPaid;
                  console.log(
                    `   💰 Applied fixed pickup tariff: ${pickupTariff} FCFA (Au bureau)`
                  );
                  console.log(
                    `   💵 Full payment recalculated: ${currentAmountPaid} -> ${newAmountPaid} (${currentAmountDue} - ${pickupTariff})`
                  );
                }
              }
              break;

            case "pending":
              updateData.status = "pending";
              historyAction = "marked_pending";
              console.log(
                `   ⏳ Livraison #${delivery.id} marquée comme EN ATTENTE`
              );
              break;

            case "modify":
              if (statusData.items) {
                updateData.items = statusData.items;
              }
              if (statusData.amount) {
                updateData.amount_due = statusData.amount;
              }
              historyAction = "modified";
              console.log(`   ✏️  Livraison #${delivery.id} MODIFIÉE`);
              if (statusData.items) {
                console.log(`   📦 Nouveaux produits: ${statusData.items}`);
              }
              if (statusData.amount) {
                console.log(`   💰 Nouveau montant: ${statusData.amount} FCFA`);
              }
              break;

            case "number_change":
              if (statusData.newPhone) {
                updateData.phone = statusData.newPhone;
                historyAction = "number_changed";
                console.log(
                  `   📱 Numéro changé: ${delivery.phone} → ${statusData.newPhone}`
                );
              }
              break;
          }

          // Update delivery - use delivery ID (we already have the delivery object)
          if (Object.keys(updateData).length > 0) {
            // We already have the delivery object, so use its ID directly
            await updateDelivery(delivery.id, updateData);
            if (deliveryFromReply && quotedMessage) {
              console.log(
                `   ✅ Mise à jour de la livraison #${delivery.id} via message ID`
              );
            } else {
              console.log(
                `   ✅ Mise à jour de la livraison #${delivery.id} via numéro de téléphone`
              );
            }

            await addHistory(
              delivery.id,
              historyAction || statusData.type,
              JSON.stringify({ ...statusData, updated_by: contactName })
            );

            // Clear success message
            console.log("\n" + "=".repeat(60));
            console.log(`   ✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅`);
            console.log("=".repeat(60));
            console.log(`   📦 Livraison #${delivery.id}`);
            console.log(`   📱 Numéro: ${delivery.phone}`);
            console.log(`   📊 Type: ${statusData.type}`);
            if (statusData.amount) {
              console.log(`   💰 Montant: ${statusData.amount} FCFA`);
            }
            console.log(`   ✅ Statut mis à jour dans la base de données`);
            console.log("=".repeat(60) + "\n");
          }
        } catch (error) {
          console.error("   ❌ Erreur lors de la mise à jour:", error.message);
        }
      } else {
        if (deliveryFromReply) {
          console.log(
            `   ⚠️  Réponse détectée mais aucune donnée de statut valide trouvée`
          );
        } else if (statusData && statusData.phone) {
          console.log(
            `   ⚠️  Aucune livraison trouvée pour le numéro: ${statusData.phone}`
          );
          console.log(
            `   💡 Créez d'abord la livraison avec le format standard`
          );
        } else if (!statusData) {
          console.log(
            "   ⚠️  Message de réponse détecté mais format de statut non reconnu"
          );
        } else {
          console.log(
            "   ⚠️  Numéro de téléphone non trouvé dans le message de statut"
          );
        }
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return; // Don't process as delivery message
    }

    // SECOND: Check if this is a NEW DELIVERY message
    // Only process if group is registered (not pending verification)
    if (!group) {
      console.log(
        "   ⚠️  Group not registered - cannot process delivery/status messages"
      );
      console.log("   💡 Group must be verified with agency code first");
      return;
    }

    const isDelivery = isDeliveryMessage(messageText);
    console.log("   🔍 isDeliveryMessage check:", isDelivery);

    if (isDelivery) {
      console.log("   ✅ Detected as DELIVERY message");

      // Parse the delivery information
      const deliveryData = parseDeliveryMessage(messageText);
      console.log("   📊 Parsed data:", JSON.stringify(deliveryData, null, 2));

      // Check if parsing was successful
      if (!deliveryData.valid) {
        console.log("   ❌ Format invalide!");
        console.log(
          "   ⚠️  Erreur:",
          deliveryData.error || "Format non reconnu"
        );
        if (deliveryData.expectedFormat) {
          console.log("   📋 Format attendu:");
          console.log(
            "      " + deliveryData.expectedFormat.split("\n").join("\n      ")
          );
        }
        console.log("\n   💡 Formats acceptés:");
        console.log("      Format 1 (Standard):");
        console.log("        Ligne 1: Numéro (ex: 612345678)");
        console.log("        Ligne 2: Produits (ex: 2 robes + 1 sac)");
        console.log("        Ligne 3: Montant (ex: 15k ou 15000)");
        console.log("        Ligne 4: Quartier (ex: Bonapriso)");
        console.log("      Format 2 (Alternatif):");
        console.log("        Ligne 1: Quartier (ex: Bessengue)");
        console.log("        Lignes 2-N: Produits (un par ligne)");
        console.log("        Avant-dernière ligne: Montant (ex: 14000)");
        console.log("        Dernière ligne: Numéro (ex: 651 07 35 74)");
        return;
      }

      // Validate required fields
      if (!deliveryData.phone && !deliveryData.hasPhone) {
        console.log("   ❌ Numéro de téléphone manquant");
        return;
      }

      if (!deliveryData.amount_due && !deliveryData.hasAmount) {
        console.log("   ❌ Montant manquant");
        return;
      }

      try {
        // Allow multiple deliveries per phone number
        // Create new delivery with group_id and agency_id
        // Store WhatsApp message ID for reply-based updates
        const whatsappMessageId = msg.id._serialized;
        console.log(`   💾 Storing WhatsApp message ID: ${whatsappMessageId}`);
        console.log(`   💾 Message ID (remote): ${msg.id?.remote}`);
        console.log(`   💾 Message ID (id): ${msg.id?.id}`);

        const deliveryId = await createDelivery({
          phone: deliveryData.phone || "unknown",
          customer_name: deliveryData.customer_name,
          items: deliveryData.items,
          amount_due: deliveryData.amount_due || 0,
          quartier: deliveryData.quartier,
          carrier: deliveryData.carrier,
          notes: `Original message: ${messageText.substring(0, 100)}`,
          group_id: group ? group.id : null,
          agency_id: agencyId,
          whatsapp_message_id: whatsappMessageId,
        });

        console.log("\n" + "=".repeat(60));
        console.log(`   ✅ LIVRAISON #${deliveryId} ENREGISTRÉE AVEC SUCCÈS!`);
        console.log("=".repeat(60));
        console.log(`   📎 WhatsApp Message ID stored: ${whatsappMessageId}`);
        console.log(`   📱 Numéro: ${deliveryData.phone || "Non trouvé"}`);
        console.log(`   📦 Produits: ${deliveryData.items}`);
        console.log(`   💰 Montant: ${deliveryData.amount_due || 0} FCFA`);
        console.log(
          `   📍 Quartier: ${deliveryData.quartier || "Non spécifié"}`
        );
        if (deliveryData.carrier) {
          console.log(`   🚚 Transporteur: ${deliveryData.carrier}`);
        }
        console.log(`   💾 Sauvegardé dans la base de données`);
        console.log(
          `   💡 Plusieurs livraisons peuvent exister pour le même numéro`
        );
        console.log(`   🔍 Pour voir toutes les livraisons: npm run view`);
        console.log("=".repeat(60) + "\n");

        // Optional: Send confirmation to group (if enabled)
        if (config.SEND_CONFIRMATIONS === "true" && config.GROUP_ID) {
          try {
            const confirmationMsg =
              `✅ Livraison #${deliveryId} enregistrée\n` +
              `📱 ${deliveryData.phone}\n` +
              `📦 ${deliveryData.items}\n` +
              `💰 ${deliveryData.amount_due || 0} FCFA`;
            const chat = await client.getChatById(config.GROUP_ID);
            await chat.sendMessage(confirmationMsg);
          } catch (error) {
            console.log("   ⚠️  Could not send confirmation message");
          }
        }
      } catch (dbError) {
        console.error("   ❌ Erreur lors de la sauvegarde:", dbError.message);
        botAlerts.notifyDeliverySaveFailed(dbError.message);
      }
    } else {
      console.log(
        "   ℹ️  Not a delivery message (might be status update or other)"
      );

      const looksMalformed = looksLikeMalformedDelivery(messageText);
      if (looksMalformed && !config.FORMAT_REMINDER_ENABLED) {
        console.log(
          "   💡 Message matches format-reminder heuristics; set FORMAT_REMINDER_ENABLED=true in .env to reply in-thread"
        );
      }

      if (config.FORMAT_REMINDER_ENABLED && looksMalformed) {
        const author = msg.author || msg.from || "unknown";
        const cooldownKey = `${whatsappGroupId}:${author}`;
        const now = Date.now();
        const lastSent = formatReminderCooldownByKey.get(cooldownKey) || 0;
        if (now - lastSent < config.FORMAT_REMINDER_COOLDOWN_MS) {
          console.log("   ⏭️  Format reminder skipped (cooldown)");
        } else {
          try {
            await msg.reply(getFormatReminderMessage());
            formatReminderCooldownByKey.set(cooldownKey, now);
            console.log("   📤  Format reminder sent (reply)");
          } catch (reminderErr) {
            console.log(
              "   ⚠️  Could not send format reminder:",
              reminderErr.message
            );
            botAlerts.notifyMessageError(reminderErr, `format-reminder:${author}`);
          }
        }
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    // Don't crash on message errors, just log them
    console.error("⚠️  Error processing message:", error.message);
    console.log("   Message from:", msg.from || "Unknown");
    console.log(
      "   Message preview:",
      (msg.body || "").substring(0, 50) + "\n"
    );
    botAlerts.notifyMessageError(error, msg.from);
  }
});

// Handle errors
client.on("error", (error) => {
  botAlerts.notifyClientError(error);
  console.error("❌ Client Error:", error.message);
  console.error("   Stack:", error.stack);
});

// Prevent uncaught errors from crashing the bot
process.on("uncaughtException", (error) => {
  console.error("⚠️  Uncaught Exception:", error.message);
  console.error("   Bot will continue running...\n");
  botAlerts.notifyProcessError("uncaughtException", error);
});

process.on("unhandledRejection", (reason, promise) => {
  // Filter out common Puppeteer errors that are harmless
  const errorMessage = reason?.message || String(reason);
  const isPuppeteerError =
    errorMessage.includes("Execution context was destroyed") ||
    errorMessage.includes("Protocol error") ||
    errorMessage.includes("Target closed");

  if (isPuppeteerError) {
    // These are common Puppeteer/WhatsApp Web.js errors that don't affect functionality
    console.warn(
      "⚠️  Puppeteer warning (can be ignored):",
      errorMessage.substring(0, 100)
    );
    console.warn("   Bot will continue running normally...\n");
  } else {
    console.error("⚠️  Unhandled Rejection:", reason);
    console.error("   Bot will continue running...\n");
    botAlerts.notifyProcessError("unhandledRejection", reason);
  }
});

// Daily report scheduler
function setupDailyReportScheduler() {
  if (!config.REPORT_ENABLED) {
    console.log("📊 Daily reports are disabled (REPORT_ENABLED=false)");
    return;
  }

  // Parse report time (HH:MM format)
  const [hours, minutes] = config.REPORT_TIME.split(":").map(Number);

  function scheduleNextReport() {
    const now = new Date();
    const reportTime = new Date();
    reportTime.setHours(hours, minutes, 0, 0);

    // If report time has passed today, schedule for tomorrow
    if (reportTime <= now) {
      reportTime.setDate(reportTime.getDate() + 1);
    }

    const msUntilReport = reportTime.getTime() - now.getTime();

    console.log(
      `📊 Daily report scheduled for: ${reportTime.toLocaleString("fr-FR")}`
    );
    console.log(`   (in ${Math.round(msUntilReport / 1000 / 60)} minutes)\n`);

    setTimeout(async () => {
      try {
        console.log("\n" + "=".repeat(70));
        console.log("📊 GENERATING DAILY REPORT...");
        console.log("=".repeat(70));

        const { report } = await generateDailyReport();

        // Send report via WhatsApp if configured
        if (config.REPORT_SEND_TO_GROUP && config.GROUP_ID) {
          try {
            const chat = await client.getChatById(config.GROUP_ID);
            await chat.sendMessage(report);
            console.log("✅ Daily report sent to WhatsApp group");
          } catch (error) {
            console.error(
              "❌ Failed to send report to WhatsApp:",
              error.message
            );
          }
        } else if (config.REPORT_RECIPIENT) {
          try {
            const chatId = `${config.REPORT_RECIPIENT}@c.us`;
            await client.sendMessage(chatId, report);
            console.log(`✅ Daily report sent to ${config.REPORT_RECIPIENT}`);
          } catch (error) {
            console.error(
              "❌ Failed to send report via WhatsApp:",
              error.message
            );
          }
        }

        console.log("=".repeat(70) + "\n");
      } catch (error) {
        console.error("❌ Error generating daily report:", error.message);
        botAlerts.notifyReportFailed(error);
      }

      // Schedule next report
      scheduleNextReport();
    }, msUntilReport);
  }

  scheduleNextReport();
}

// Initialize the client
console.log("\n" + "=".repeat(60));
console.log("🚀 Starting WhatsApp bot...");
console.log("=".repeat(60));
console.log("⏳ Initializing WhatsApp client...");
console.log("💡 This may take 30-60 seconds (Puppeteer needs to start)");
console.log("💡 First startup is slower (Chrome download if needed)");
console.log("💡 Please wait for QR code to appear...");
console.log("🔄 Starting Puppeteer browser...");
console.log("=".repeat(60) + "\n");

// Initialize with error handling
try {
  console.log("🔄 Calling client.initialize()...\n");
  client.initialize();
  console.log("✅ client.initialize() called successfully");
  console.log("💡 Waiting for authentication and ready event...\n");
} catch (error) {
  console.error("❌ CRITICAL ERROR: Failed to initialize client!");
  console.error("   Error:", error.message);
  console.error("   Stack:", error.stack);
  process.exit(1);
}
