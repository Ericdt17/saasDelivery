/**
 * Utility to send messages via WhatsApp
 * Can send to groups or individual contacts
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const path = require("path");

// Note: This requires the bot to be running to use the same client
// For standalone usage, we'd need to initialize a new client

/**
 * Send message to a WhatsApp group
 * @param {string} groupId - The WhatsApp group ID
 * @param {string} message - The message to send
 */
async function sendToGroup(groupId, message) {
  // This function requires access to the running client
  // In production, you'd get this from your main bot instance
  throw new Error("Use sendMessage utility from the running bot instance");
}

/**
 * Send message to a contact/phone number
 * @param {string} phoneNumber - Phone number (e.g., "612345678")
 * @param {string} message - The message to send
 */
async function sendToContact(phoneNumber, message) {
  throw new Error("Use sendMessage utility from the running bot instance");
}

/**
 * Standalone script to send a message (creates its own client)
 * Usage: node src/send-message.js --group=GROUP_ID "Your message"
 *        node src/send-message.js --phone=612345678 "Your message"
 */
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    
    // Debug: Show all arguments received
    console.log("\n🔍 Debug - Arguments received:");
    console.log("   Raw args:", args);
    console.log("");

    // Parse arguments
    const groupArg = args.find(arg => arg.startsWith('--group='));
    const phoneArg = args.find(arg => arg.startsWith('--phone='));
    const messageParts = args.filter(arg => !arg.startsWith('--'));
    const message = messageParts.join(' ').trim();

    console.log("🔍 Debug - Parsed:");
    console.log("   Group arg:", groupArg || "none");
    console.log("   Phone arg:", phoneArg || "none");
    console.log("   Message parts:", messageParts);
    console.log("   Final message:", message ? `"${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"` : "EMPTY");
    console.log("");

    if (!message || message.length === 0) {
      console.error("❌ Error: No message provided or message is empty!");
      console.error("\n💡 Common issues:");
      console.error("   - Missing quotes around message");
      console.error("   - PowerShell quote handling");
      console.error("\n📋 Usage examples:");
      console.error('   npm run send -- --group=GROUP_ID "Your message"');
      console.error('   npm run send "Your message here"');
      console.error('\n💡 For PowerShell, try:');
      console.error('   npm run send -- --group=GROUP_ID \'Your message\'');
      console.error('   npm run send "Your message here"');
      console.error('\n🔍 What was received:');
      console.error(`   Arguments: ${JSON.stringify(args)}`);
      console.error(`   Message: "${message}"`);
      process.exit(1);
    }

    // Check if main bot might be running
    const fs = require("fs");
    const path = require("path");
    
    // Check for lock file or running process indicator
    try {
      const lockFile = path.join(__dirname, "..", "auth", ".lock");
      if (fs.existsSync(lockFile)) {
        console.log("\n⚠️  WARNING: Detected potential conflict!");
        console.log("   The main bot might be running.");
        console.log("   💡 Solution: Stop the main bot (Ctrl+C) and try again.");
        console.log("   Or wait 10 seconds and try again.\n");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      // Ignore lock file check errors
    }

    console.log("\n⚠️  REMINDER:");
    console.log("   If the main bot (npm run dev) is running, stop it first!");
    console.log("   Both cannot use the same WhatsApp session at the same time.\n");

    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: "./auth",
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      },
    });

    // Handle connection errors
    client.on("disconnected", (reason) => {
      console.error("\n❌ WhatsApp client disconnected:", reason);
      console.error("   This might happen if another instance is using the session.");
    });

    client.on("ready", async () => {
    console.log("✅ WhatsApp client ready");
    
    try {
      if (groupArg) {
        let groupId = groupArg.split('=')[1];
        
        // Check if it's a placeholder
        if (groupId === "YOUR_GROUP_ID" || !groupId) {
          console.error("❌ Error: Please provide a valid GROUP_ID");
          console.error("   Example: npm run send -- --group=120363123456789012@g.us \"Your message\"");
          console.error("   Or set GROUP_ID in .env file and use: npm run send \"Your message\"");
          await client.destroy();
          process.exit(1);
        }

        console.log(`📤 Sending message to group...`);
        
        // Ensure group ID is in correct format
        if (!groupId.includes('@')) {
          groupId = `${groupId}@g.us`;
        }
        
        try {
          console.log(`   Looking up group: ${groupId}`);
          const chat = await client.getChatById(groupId);
          console.log(`   ✅ Found group: "${chat.name || 'Unknown'}"`);
          console.log(`   📊 Group participants: ${chat.participants?.length || 'N/A'}`);
          
          // Verify bot is in the group
          try {
            const botInfo = client.info;
            if (botInfo && chat.participants) {
              const botId = botInfo.wid?.user || botInfo.wid?._serialized;
              const isInGroup = chat.participants.some(p => {
                const participantId = p.id?.user || p.id?._serialized;
                return participantId === botId || p.id?._serialized?.includes(botId);
              });
              
              if (!isInGroup) {
                console.log("   ⚠️  WARNING: Bot might not be a member of this group!");
                console.log("   💡 Add the bot's WhatsApp number to the group first");
              } else {
                console.log("   ✅ Bot is confirmed as a group member");
              }
            }
          } catch (checkError) {
            console.log("   ⚠️  Could not verify bot membership");
          }
          
          console.log(`\n   📤 Sending message...`);
          
          // Try multiple methods to ensure message is sent
          let sentMessage;
          try {
            // Method 1: Direct sendMessage
            sentMessage = await chat.sendMessage(message);
            console.log(`   ✅ sendMessage() returned successfully`);
          } catch (sendError) {
            console.error(`   ❌ sendMessage() failed: ${sendError.message}`);
            // Try alternative method
            try {
              console.log(`   🔄 Trying alternative send method...`);
              sentMessage = await client.sendMessage(groupId, message);
              console.log(`   ✅ Alternative method succeeded`);
            } catch (altError) {
              console.error(`   ❌ Alternative method also failed: ${altError.message}`);
              throw sendError;
            }
          }
          
          if (sentMessage) {
            console.log("   ✅ Message sent successfully!");
            if (sentMessage.id) {
              console.log(`   📱 Message ID: ${sentMessage.id._serialized || sentMessage.id}`);
            }
            console.log(`   ⏰ Sent at: ${new Date().toLocaleString("fr-FR")}`);
            
            // Wait and verify
            console.log(`   🔍 Waiting 3 seconds and verifying...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
              // Refresh chat and check messages
              await chat.sendSeen(); // Mark as read to trigger sync
              const messages = await chat.fetchMessages({ limit: 10 });
              
              // Look for our message
              const ourMessage = messages.find(m => {
                if (m.fromMe && m.body && m.body.trim() === message.trim()) {
                  return true;
                }
                if (sentMessage.id && m.id?._serialized === sentMessage.id?._serialized) {
                  return true;
                }
                return false;
              });
              
              if (ourMessage) {
                console.log(`   ✅ VERIFIED: Message found in chat history!`);
                console.log(`   📝 Content: "${ourMessage.body?.substring(0, 60)}${ourMessage.body?.length > 60 ? '...' : ''}"`);
                console.log(`   ⏰ Timestamp: ${ourMessage.timestamp ? new Date(ourMessage.timestamp * 1000).toLocaleString("fr-FR") : 'N/A'}`);
                console.log(`   ✅ Message is confirmed in the group!`);
              } else {
                console.log(`   ⚠️  WARNING: Message not found in recent chat history`);
                console.log(`   📋 Recent messages in group:`);
                messages.slice(0, 3).forEach((m, i) => {
                  console.log(`      ${i+1}. ${m.fromMe ? '[FROM BOT]' : '[FROM OTHERS]'} ${m.body?.substring(0, 40) || '...'}`);
                });
                console.log(`   💡 The message might still be sent but not synced yet`);
              }
            } catch (verifyError) {
              console.log(`   ⚠️  Could not verify message: ${verifyError.message}`);
            }
            
            // Get bot's phone number for reference
            try {
              const botInfo = client.info;
              if (botInfo && botInfo.wid) {
                console.log(`\n   📱 Bot's WhatsApp number: ${botInfo.wid.user || botInfo.wid._serialized}`);
                console.log(`   💡 Look for messages from this number in the group`);
              }
            } catch (infoError) {
              // Ignore
            }
            
            console.log(`\n💡 Summary:`);
            console.log(`   - Target group: "${chat.name}"`);
            console.log(`   - Group ID: ${groupId}`);
            console.log(`   - Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
            console.log(`\n🔍 If message is still not visible:`);
            console.log(`   1. Check if "${chat.name}" is the correct group`);
            console.log(`   2. Look for messages from the bot's phone number (shown above)`);
            console.log(`   3. Try sending from the bot's phone manually to test`);
            console.log(`   4. Check group admin settings - bot might need permission`);
          } else {
            console.log("   ❌ Message send failed - no response received");
          }
        } catch (chatError) {
          console.error("❌ Error: Could not send to group. Possible reasons:");
          console.error("   1. Group ID is incorrect or doesn't exist");
          console.error("   2. Bot is not a member of the group");
          console.error("   3. Group ID format should be: 120363123456789012@g.us");
          console.error(`   Error: ${chatError.message}`);
          throw chatError;
        }
      } else if (phoneArg) {
        const phone = phoneArg.split('=')[1];
        const chatId = `${phone.replace(/[^0-9]/g, '')}@c.us`;
        console.log(`📤 Sending message to: ${phone}`);
        try {
          await client.sendMessage(chatId, message);
          console.log("✅ Message sent successfully!");
        } catch (phoneError) {
          console.error("❌ Error: Could not send to contact. Possible reasons:");
          console.error("   1. Phone number is incorrect");
          console.error("   2. Contact doesn't exist in your WhatsApp");
          console.error(`   Error: ${phoneError.message}`);
          throw phoneError;
        }
      } else if (config.GROUP_ID) {
        // Use default group from config
        let groupId = config.GROUP_ID;
        console.log(`📤 Sending message to default group from config...`);
        
        // Ensure group ID is in correct format
        if (!groupId.includes('@')) {
          groupId = `${groupId}@g.us`;
        }
        
        try {
          console.log(`   Looking up group: ${groupId}`);
          const chat = await client.getChatById(groupId);
          console.log(`   ✅ Found group: "${chat.name || 'Unknown'}"`);
          console.log(`   📊 Group participants: ${chat.participants?.length || 'N/A'}`);
          
          // Verify bot membership
          try {
            const botInfo = client.info;
            if (botInfo && chat.participants) {
              const botId = botInfo.wid?.user || botInfo.wid?._serialized;
              const isInGroup = chat.participants.some(p => {
                const participantId = p.id?.user || p.id?._serialized;
                return participantId === botId || p.id?._serialized?.includes(botId);
              });
              
              if (!isInGroup) {
                console.log("   ⚠️  WARNING: Bot might not be a member of this group!");
              } else {
                console.log("   ✅ Bot is confirmed as a group member");
              }
            }
          } catch (checkError) {
            // Ignore
          }
          
          console.log(`\n   📤 Sending message...`);
          console.log(`   Message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`);
          
          let sentMessage;
          try {
            sentMessage = await chat.sendMessage(message);
            console.log(`   ✅ Message sent successfully!`);
            
            if (sentMessage && sentMessage.id) {
              console.log(`   📱 Message ID: ${sentMessage.id._serialized || sentMessage.id}`);
              console.log(`   ⏰ Sent at: ${new Date().toLocaleString("fr-FR")}`);
              
              // Verify
              console.log(`   🔍 Verifying...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              try {
                await chat.sendSeen();
                const messages = await chat.fetchMessages({ limit: 10 });
                const found = messages.find(m => m.fromMe && m.body?.trim() === message.trim());
                if (found) {
                  console.log(`   ✅ VERIFIED: Message confirmed in chat!`);
                }
              } catch (e) {}
            }
            
            // Show bot number
            try {
              const botInfo = client.info;
              if (botInfo && botInfo.wid) {
                console.log(`\n   📱 Bot's number: +${botInfo.wid.user || botInfo.wid._serialized}`);
              }
            } catch (e) {}
            
            console.log(`\n💡 If you don't see the message:`);
            console.log(`   1. Check group: "${chat.name}" - is this correct?`);
            console.log(`   2. Look for messages from bot's phone number (shown above)`);
            console.log(`   3. Refresh your WhatsApp group`);
          } catch (sendError) {
            console.error(`   ❌ Send failed: ${sendError.message}`);
            throw sendError;
          }
        } catch (configError) {
          console.error("❌ Error: Could not send to configured group:");
          console.error(`   GROUP_ID in .env: ${config.GROUP_ID}`);
          console.error("   Check if the group ID is correct and bot is member of the group");
          console.error(`   Error: ${configError.message}`);
          throw configError;
        }
      } else {
        console.error("❌ Error: Please specify --group=GROUP_ID or --phone=PHONE");
        console.error("\nUsage examples:");
        console.error('  npm run send -- --group=120363123456789012@g.us "Your message"');
        console.error('  npm run send -- --phone=612345678 "Your message"');
        console.error('  npm run send "Your message"  (requires GROUP_ID in .env)');
        await client.destroy();
        process.exit(1);
      }
    } catch (error) {
      console.error(`\n❌ Error sending message: ${error.message}`);
      
      // Handle specific errors
      if (error.message.includes("Target closed") || error.message.includes("Protocol error")) {
        console.error("\n💡 This error usually means:");
        console.error("   1. The main bot is already running (using the same session)");
        console.error("   2. WhatsApp session expired or disconnected");
        console.error("   3. Multiple instances trying to use the same auth session");
        console.error("\n🔧 Solutions:");
        console.error("   - Stop the main bot first, then try sending");
        console.error("   - Or use the running bot instance to send messages");
        console.error("   - Restart the bot if session issues persist");
      }
      
      if (error.stack) {
        console.error("\nFull error details:", error.stack);
      }
      
      try {
        await client.destroy();
      } catch (destroyError) {
        // Ignore destroy errors
      }
      process.exit(1);
    }

      await client.destroy();
      process.exit(0);
    });

    client.on("qr", (qr) => {
      console.log("\n⚠️  QR code required. Please scan with your phone.");
      console.log("   (This happens if session expired or not authenticated)");
      console.log("   💡 Tip: Run the main bot first to authenticate, then use this script.\n");
      
      // Show QR code
      const qrcode = require("qrcode-terminal");
      qrcode.generate(qr, { small: true });
      
      console.log("\n⏳ Waiting for QR scan... (Press Ctrl+C to cancel)");
      console.log("   After scanning, the message will be sent automatically.\n");
    });

    client.on("authenticated", () => {
      console.log("✅ Authenticated! Session saved.\n");
    });

    client.on("auth_failure", (msg) => {
      console.error("❌ Authentication failed:", msg);
      process.exit(1);
    });

    client.initialize();
  })().catch((error) => {
    console.error("\n❌ Fatal error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { sendToGroup, sendToContact };

