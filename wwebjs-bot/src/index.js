const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { isDeliveryMessage, parseDeliveryMessage } = require("./parser");
const { parseStatusUpdate, isStatusUpdate } = require("./statusParser");
const {
  createDelivery,
  findDeliveryByPhone,
  findDeliveryByPhoneForUpdate,
  findDeliveryByMessageId,
  updateDelivery,
  addHistory,
} = require("./db");
const { generateDailyReport } = require("./daily-report");
const { getOrCreateGroup, getAgencyIdForGroup } = require("./utils/group-manager");

// Create WhatsApp client with local auth (saves session)
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./auth",
  }),
});

// Show QR code in terminal when authentication needed
let qrShown = false;
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
  } else {
    console.log("\n⚠️  QR code refreshed! Scan the NEWEST QR code below:");
    console.log("   (Open WhatsApp → Linked Devices → Link a Device)\n");
  }

  // Show medium-sized QR code in terminal
  qrcode.generate(qr, { small: true });

  // Also save as image file for easier scanning
  try {
    const qrImagePath = path.join(__dirname, "..", "qr-code.png");
    await QRCode.toFile(qrImagePath, qr, {
      width: 200,
      margin: 1,
    });
    console.log("\n💡 QR code also saved as: qr-code.png");
    console.log("   Open this file with your image viewer to scan it!\n");
  } catch (err) {
    console.log(
      "   (Could not save QR code image, but terminal QR code should work)\n"
    );
  }
});

// When client is ready
client.on("ready", () => {
  console.log("\n✅ Bot is ready!");
  console.log("📋 Listening for messages...\n");
  qrShown = false; // Reset for next time

  // Setup daily report scheduler
  setupDailyReportScheduler();
});

// When client is authenticated
client.on("authenticated", () => {
  console.log("\n" + "=".repeat(60));
  console.log("✅ AUTHENTICATED SUCCESSFULLY!");
  console.log("✅ Session saved!");
  console.log("💡 You won't need to scan QR code again next time.");
  console.log("=".repeat(60) + "\n");
});

// When authentication fails
client.on("auth_failure", (msg) => {
  console.error("\n" + "=".repeat(60));
  console.error("❌ AUTHENTICATION FAILED!");
  console.error("Error:", msg);
  console.error("=".repeat(60) + "\n");
});

// When client is disconnected
client.on("disconnected", (reason) => {
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
client.on("message", async (msg) => {
  try {
    // Skip messages from the bot itself (to avoid loops)
    if (msg.fromMe) {
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

    // Filter: Only handle messages from the configured group (if GROUP_ID is set)
    // If GROUP_ID is not set (null), process messages from all groups
    if (targetGroupId && whatsappGroupId !== targetGroupId) {
      console.log("   ⏭️  Skipped: Different group (GROUP_ID is configured)\n");
      console.log("   💡 Tip: Remove GROUP_ID from .env to process all groups\n");
      return; // Skip messages from other groups
    }

    console.log("   ✅ Processing: Group message detected!\n");

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
        
        console.log(`   📎 Quoted message ID (_serialized): ${quotedIdSerialized}`);
        console.log(`   📎 Quoted message ID (remote): ${quotedIdRemote}`);
        console.log(`   📎 Quoted message ID (id): ${quotedIdId}`);
        console.log(`   📎 Full quoted message ID object:`, JSON.stringify(quotedMessage.id, null, 2));
        
        // Try to find delivery by quoted message ID (try multiple formats)
        if (quotedIdSerialized) {
          console.log(`   🔍 Searching for delivery with ID: ${quotedIdSerialized}`);
          deliveryFromReply = await findDeliveryByMessageId(quotedIdSerialized);
        }
        
        // If not found, try with remote ID
        if (!deliveryFromReply && quotedIdRemote) {
          console.log(`   🔍 Searching for delivery with remote ID: ${quotedIdRemote}`);
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
          const serializedParts = quotedIdSerialized?.split('_');
          if (serializedParts && serializedParts.length > 0) {
            // Try with just the last part (the actual message ID)
            const lastPart = serializedParts[serializedParts.length - 1];
            console.log(`   🔍 Trying with extracted ID part: ${lastPart}`);
            deliveryFromReply = await findDeliveryByMessageId(lastPart);
          }
        }
        
        if (deliveryFromReply) {
          console.log(`   ✅ Found delivery #${deliveryFromReply.id} linked to quoted message`);
        } else {
          console.log(`   ⚠️  No delivery found for quoted message ID`);
          console.log(`   💡 The original delivery message might not have been stored with message ID`);
        }
      }
    } catch (replyError) {
      // Not a reply or error getting quoted message, continue normally
      console.log("   ℹ️  Not a reply or couldn't get quoted message");
      console.log(`   ⚠️  Error details: ${replyError.message}`);
    }

    // Auto-register group if not exists
    let group = null;
    let agencyId = null;
    try {
      group = await getOrCreateGroup(whatsappGroupId, groupName, config.DEFAULT_AGENCY_ID);
      if (group) {
        agencyId = group.agency_id;
        console.log(`   📋 Group: ${group.name} (DB ID: ${group.id}, Agency: ${agencyId})`);
      }
    } catch (groupError) {
      console.error(`   ⚠️  Error registering group: ${groupError.message}`);
      // Continue processing even if group registration fails
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
        console.log("   📊 Status data from reply:", JSON.stringify(statusData, null, 2));
      }

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
                break;

              case "failed":
                updateData.status = "failed";
                historyAction = "marked_failed";
                console.log(
                  `   ❌ Livraison #${delivery.id} marquée comme ÉCHEC`
                );
                break;

              case "payment":
                // If amount is not specified, use the remaining amount due
                let paymentAmount = statusData.amount;
                if (!paymentAmount || paymentAmount === 0) {
                  const remainingAmount = (delivery.amount_due || 0) - (delivery.amount_paid || 0);
                  paymentAmount = remainingAmount > 0 ? remainingAmount : delivery.amount_due || 0;
                  console.log(
                    `   💡 Montant non spécifié, utilisation du montant restant: ${paymentAmount} FCFA`
                  );
                }
                
                const newAmountPaid =
                  (delivery.amount_paid || 0) + paymentAmount;
                updateData.amount_paid = newAmountPaid;
                historyAction = "payment_collected";
                console.log(
                  `   💰 Paiement collecté: ${paymentAmount} FCFA`
                );
                console.log(
                  `   💵 Total payé: ${newAmountPaid} FCFA / ${delivery.amount_due} FCFA`
                );

                // Auto-mark as delivered if fully paid
                if (newAmountPaid >= delivery.amount_due) {
                  updateData.status = "delivered";
                  console.log(
                    `   ✅ Livraison complètement payée - marquée comme LIVRÉE`
                  );
                }
                break;

              case "pickup":
                updateData.status = "pickup";
                historyAction = "marked_pickup";
                console.log(
                  `   📦 Livraison #${delivery.id} marquée comme PICKUP`
                );
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
                  console.log(
                    `   💰 Nouveau montant: ${statusData.amount} FCFA`
                  );
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

            // Update delivery
            if (Object.keys(updateData).length > 0) {
              await updateDelivery(delivery.id, updateData);
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
            console.error(
              "   ❌ Erreur lors de la mise à jour:",
              error.message
            );
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
        // Check if there's already a pending delivery for this phone
        const existingDelivery = deliveryData.phone
          ? await findDeliveryByPhone(deliveryData.phone)
          : null;

        if (existingDelivery) {
          console.log(
            `   ⚠️  Livraison existante trouvée #${existingDelivery.id} pour ce numéro`
          );
          console.log(
            `   💡 Si c'est une nouvelle livraison, utilisez un format différent`
          );
        } else {
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
          console.log(
            `   ✅ LIVRAISON #${deliveryId} ENREGISTRÉE AVEC SUCCÈS!`
          );
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
          console.log(`   🔍 Pour voir toutes les livraisons: npm run view`);
          console.log("=".repeat(60) + "\n");

          // Optional: Send confirmation to group (if enabled)
          if (config.SEND_CONFIRMATIONS === "true" && config.GROUP_ID) {
            try {
              const confirmationMsg = `✅ Livraison #${deliveryId} enregistrée\n` +
                `📱 ${deliveryData.phone}\n` +
                `📦 ${deliveryData.items}\n` +
                `💰 ${deliveryData.amount_due || 0} FCFA`;
              const chat = await client.getChatById(config.GROUP_ID);
              await chat.sendMessage(confirmationMsg);
            } catch (error) {
              console.log("   ⚠️  Could not send confirmation message");
            }
          }
        }
      } catch (dbError) {
        console.error("   ❌ Erreur lors de la sauvegarde:", dbError.message);
      }
    } else {
      console.log(
        "   ℹ️  Not a delivery message (might be status update or other)"
      );
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
  }
});

// Handle errors
client.on("error", (error) => {
  console.error("❌ Client Error:", error.message);
});

// Prevent uncaught errors from crashing the bot
process.on("uncaughtException", (error) => {
  console.error("⚠️  Uncaught Exception:", error.message);
  console.error("   Bot will continue running...\n");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️  Unhandled Rejection:", reason);
  console.error("   Bot will continue running...\n");
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
    
    console.log(`📊 Daily report scheduled for: ${reportTime.toLocaleString("fr-FR")}`);
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
            console.error("❌ Failed to send report to WhatsApp:", error.message);
          }
        } else if (config.REPORT_RECIPIENT) {
          try {
            const chatId = `${config.REPORT_RECIPIENT}@c.us`;
            await client.sendMessage(chatId, report);
            console.log(`✅ Daily report sent to ${config.REPORT_RECIPIENT}`);
          } catch (error) {
            console.error("❌ Failed to send report via WhatsApp:", error.message);
          }
        }

        console.log("=".repeat(70) + "\n");
      } catch (error) {
        console.error("❌ Error generating daily report:", error.message);
      }

      // Schedule next report
      scheduleNextReport();
    }, msUntilReport);
  }

  scheduleNextReport();
}


// Initialize the client
console.log("🚀 Starting WhatsApp bot...");
client.initialize();
