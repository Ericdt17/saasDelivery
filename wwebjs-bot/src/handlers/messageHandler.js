"use strict";

const config = require("../config");
const { parseStatusUpdate, isStatusUpdate } = require("../statusParser");
const {
  findDeliveryByMessageId,
  findDeliveryByPhoneForUpdate,
} = require("../db");
const { getGroup } = require("../utils/group-manager");
const botAlerts = require("../lib/botAlerts");
const { handleStatusUpdate } = require("./statusUpdateHandler");
const { handleDelivery } = require("./deliveryHandler");

/**
 * Main entry point for every incoming WhatsApp message.
 * Handles: group filtering, #link command, reply detection, status routing, delivery routing.
 *
 * @param {object} msg    - WhatsApp message object
 * @param {object} client - WhatsApp client
 */
async function onMessage(msg, client) {
  try {
    console.log("🔔 MESSAGE EVENT FIRED - Bot received a message!");

    if (msg.fromMe) {
      console.log("   ⏭️  Skipped: Message from bot itself\n");
      return;
    }

    const chat = await msg.getChat();
    const messageText = msg.body || "";

    console.log("\n🔍 DEBUG - Raw message received:");
    console.log("   isGroup:", chat.isGroup);
    console.log("   groupId:", chat.id?._serialized || "N/A");
    console.log("   targetGroupId:", config.GROUP_ID);
    console.log("   message length:", messageText.length);
    console.log("   message preview:", messageText.substring(0, 150));

    if (!chat.isGroup) {
      console.log("   ⏭️  Skipped: Not a group message\n");
      return;
    }

    const whatsappGroupId = chat.id._serialized;
    const groupName = chat.name || "Unnamed Group";
    const targetGroupId = config.GROUP_ID;

    // ── #link command ───────────────────────────────────────────────────
    if (messageText.trim().toLowerCase() === "#link") {
      console.log("   🔗 #link command detected - sending group ID");
      await sendLinkMessage(client, whatsappGroupId, groupName);
      return;
    }

    // ── Group filter ────────────────────────────────────────────────────
    if (targetGroupId && whatsappGroupId !== targetGroupId) {
      console.log("   ⏭️  Skipped: Different group (GROUP_ID is configured)\n");
      return;
    }

    console.log("   ✅ Processing: Group message detected!\n");

    // ── Reply detection ─────────────────────────────────────────────────
    let quotedMessage = null;
    let deliveryFromReply = null;
    try {
      if (msg.hasQuotedMsg) {
        quotedMessage = await msg.getQuotedMessage();
        console.log("   💬 This is a REPLY to a previous message");

        const quotedIdSerialized = quotedMessage.id?._serialized;
        const quotedIdRemote = quotedMessage.id?.remote;
        const quotedIdId = quotedMessage.id?.id;

        console.log(`   📎 Quoted message ID (_serialized): ${quotedIdSerialized}`);
        console.log(`   📎 Quoted message ID (remote): ${quotedIdRemote}`);
        console.log(`   📎 Quoted message ID (id): ${quotedIdId}`);

        if (quotedIdSerialized) {
          deliveryFromReply = await findDeliveryByMessageId(quotedIdSerialized);
        }
        if (!deliveryFromReply && quotedIdRemote) {
          deliveryFromReply = await findDeliveryByMessageId(quotedIdRemote);
        }
        if (!deliveryFromReply && quotedIdId) {
          deliveryFromReply = await findDeliveryByMessageId(quotedIdId);
        }
        if (!deliveryFromReply && quotedIdSerialized) {
          const parts = quotedIdSerialized.split("_");
          const lastPart = parts[parts.length - 1];
          deliveryFromReply = await findDeliveryByMessageId(lastPart);
        }

        if (deliveryFromReply) {
          console.log(`   ✅ Found delivery #${deliveryFromReply.id} linked to quoted message`);
        } else {
          console.log(`   ⚠️  No delivery found for quoted message ID`);
        }
      }
    } catch (replyError) {
      console.log("   ℹ️  Not a reply or couldn't get quoted message");
      console.log(`   ⚠️  Error details: ${replyError.message}`);
    }

    // ── Group DB lookup ─────────────────────────────────────────────────
    let group = null;
    let agencyId = null;
    try {
      group = await getGroup(whatsappGroupId);
      if (!group) {
        console.log(`   ⏭️  Skipped: Group not registered in database`);
        return;
      }
      agencyId = group.agency_id;
      console.log(`   📋 Group: ${group.name} (DB ID: ${group.id}, Agency: ${agencyId})`);
    } catch (groupError) {
      console.error(`   ⚠️  Error checking group: ${groupError.message}`);
      return;
    }

    // ── Contact info ────────────────────────────────────────────────────
    let contactName = "Unknown";
    try {
      const contact = await msg.getContact();
      contactName = contact.pushname || contact.name || msg.from || "Unknown";
    } catch {
      contactName = msg.notifyName || msg.from || "Unknown";
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 Message from Target Group:");
    console.log("   Group Name:", chat.name);
    console.log("   From:", contactName);
    console.log("   Full Message:", messageText);
    console.log("   Message Length:", messageText.length);

    // ── Status update path ──────────────────────────────────────────────
    const isStatus = isStatusUpdate(messageText) || deliveryFromReply;
    if (isStatus) {
      console.log("   🔄 Detected as STATUS UPDATE");

      let delivery = deliveryFromReply;
      let statusData = null;

      if (!delivery) {
        statusData = parseStatusUpdate(messageText);
        console.log("   📊 Status data:", JSON.stringify(statusData, null, 2));
        if (statusData && statusData.phone) {
          delivery = await findDeliveryByPhoneForUpdate(statusData.phone);
        }
      } else {
        statusData = parseStatusUpdate(messageText, true);
        console.log("   📊 Status data from reply:", JSON.stringify(statusData, null, 2));
      }

      await handleStatusUpdate({
        delivery,
        statusData,
        agencyId,
        contactName,
        deliveryFromReply,
        quotedMessage,
      });

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return;
    }

    // ── New delivery path ───────────────────────────────────────────────
    await handleDelivery({
      messageText,
      msg,
      group,
      agencyId,
      client,
      config,
      whatsappGroupId,
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("⚠️  Error processing message:", error.message);
    console.log("   Message from:", msg.from || "Unknown");
    console.log("   Message preview:", (msg.body || "").substring(0, 50) + "\n");
    botAlerts.notifyMessageError(error, msg.from);
  }
}

/**
 * Send the group WhatsApp ID back to the group (3-method fallback chain).
 */
async function sendLinkMessage(client, whatsappGroupId, groupName) {
  const text =
    `📋 ID du groupe WhatsApp:\n\n` +
    `\`${whatsappGroupId}\`\n\n` +
    `💡 Copiez cet ID et collez-le dans votre tableau de bord pour lier ce groupe à votre agence.\n\n` +
    `📝 Nom du groupe: ${groupName}`;

  let messageSent = false;

  // Method 1: Patch sendSeen() temporarily to bypass markedUnread error
  try {
    const page = client.pupPage;
    if (!page || page.isClosed()) throw new Error("Puppeteer page not available");

    await page.evaluate(() => {
      if (window.WWebJS?.sendSeen) {
        window._originalSendSeen = window.WWebJS.sendSeen;
        window.WWebJS.sendSeen = async () => Promise.resolve();
      }
    });
    try {
      await client.sendMessage(whatsappGroupId, text);
      messageSent = true;
      console.log(`   ✅ Group ID sent successfully`);
    } finally {
      await page.evaluate(() => {
        if (window._originalSendSeen) {
          window.WWebJS.sendSeen = window._originalSendSeen;
          delete window._originalSendSeen;
        }
      });
    }
  } catch (err1) {
    console.log(`   ⚠️  Method 1 failed: ${err1.message}`);

    // Method 2: WWebJS.sendMessage via Puppeteer
    try {
      const page = client.pupPage;
      if (!page || page.isClosed()) throw new Error("Puppeteer page not available");

      const result = await page.evaluate(
        async (groupId, msg) => {
          try {
            if (window.WWebJS?.sendMessage) {
              await window.WWebJS.sendMessage(groupId, msg);
              return { success: true };
            }
            throw new Error("WWebJS.sendMessage not available");
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
        whatsappGroupId,
        text
      );

      if (!result.success) throw new Error(result.error);
      messageSent = true;
      console.log(`   ✅ Group ID sent via WWebJS.sendMessage`);
    } catch (err2) {
      console.log(`   ⚠️  Method 2 failed: ${err2.message}`);

      // Method 3: Standard method, ignore markedUnread
      try {
        await client.sendMessage(whatsappGroupId, text);
        messageSent = true;
        console.log(`   ✅ Group ID sent (standard method)`);
      } catch (err3) {
        if (err3.message?.includes("markedUnread")) {
          messageSent = true; // message was likely sent despite the error
          console.log(`   ⚠️  markedUnread error — message likely sent`);
        } else {
          console.error(`   ❌ All send methods failed: ${err3.message}`);
        }
      }
    }
  }

  if (!messageSent) {
    console.error(`   ❌ Failed to send group ID message`);
  }
}

module.exports = { onMessage };
