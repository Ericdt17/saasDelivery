"use strict";

const { createDelivery, findDeliveryByMessageId } = require("../db");
const {
  parseDeliveryMessage,
  isExcludedFromDeliveryParsing,
  looksLikeMalformedDeliveryWithParsed,
  getFormatReminderMessage,
} = require("../parser");
const {
  extractDeliveryWithAI,
  validateAndNormalizeAiDelivery,
} = require("../lib/aiDeliveryExtract");
const botAlerts = require("../lib/botAlerts");

/** groupId:author → timestamp of last format-reminder sent (ms) */
const formatReminderCooldownByKey = new Map();

/**
 * Handle an incoming message as a potential new delivery.
 * Tries strict parse → AI fallback → format reminder, in that order.
 *
 * @param {{
 *   messageText: string,
 *   msg: object,        WhatsApp message object
 *   group: object,      group row from DB
 *   agencyId: number,
 *   client: object,     WhatsApp client (for sending confirmations)
 *   config: object,
 *   whatsappGroupId: string,
 * }} ctx
 */
async function handleDelivery({
  messageText,
  msg,
  group,
  agencyId,
  client,
  config,
  whatsappGroupId,
}) {
  if (isExcludedFromDeliveryParsing(messageText)) {
    console.log(
      "   ⏭️  Excluded from delivery parsing (status / mention / etc.)"
    );
    return;
  }

  const whatsappMessageId = msg.id._serialized;
  const deliveryData = parseDeliveryMessage(messageText);
  console.log(
    "   🔍 strict delivery parse valid:",
    deliveryData.valid,
    deliveryData.valid ? "" : `( ${deliveryData.error || "invalid"} )`
  );
  console.log("   📊 Parsed data:", JSON.stringify(deliveryData, null, 2));

  // ── Strict parse succeeded ──────────────────────────────────────────────
  if (deliveryData.valid) {
    console.log("   ✅ Detected as DELIVERY message (strict parse)");

    if (!deliveryData.phone && !deliveryData.hasPhone) {
      console.log("   ❌ Numéro de téléphone manquant");
      return;
    }
    if (!deliveryData.amount_due && !deliveryData.hasAmount) {
      console.log("   ❌ Montant manquant");
      return;
    }

    try {
      const existingByMsg = await findDeliveryByMessageId(whatsappMessageId);
      if (existingByMsg) {
        console.log(
          `   ⏭️  Delivery already exists for this message ID — skip create (id=${existingByMsg.id})`
        );
        return;
      }

      console.log(`   💾 Storing WhatsApp message ID: ${whatsappMessageId}`);
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
      console.log(`   📍 Quartier: ${deliveryData.quartier || "Non spécifié"}`);
      if (deliveryData.carrier) console.log(`   🚚 Transporteur: ${deliveryData.carrier}`);
      console.log("=".repeat(60) + "\n");

      if (config.SEND_CONFIRMATIONS === "true" && config.GROUP_ID) {
        try {
          const confirmMsg =
            `✅ Livraison #${deliveryId} enregistrée\n` +
            `📱 ${deliveryData.phone}\n` +
            `📦 ${deliveryData.items}\n` +
            `💰 ${deliveryData.amount_due || 0} FCFA`;
          const chat = await client.getChatById(config.GROUP_ID);
          await chat.sendMessage(confirmMsg);
        } catch {
          console.log("   ⚠️  Could not send confirmation message");
        }
      }
    } catch (dbError) {
      console.error("   ❌ Erreur lors de la sauvegarde:", dbError.message);
      botAlerts.notifyDeliverySaveFailed(dbError.message);
    }
    return;
  }

  // ── Strict parse failed ─────────────────────────────────────────────────
  console.log("   ℹ️  Strict parse failed (not a valid structured delivery format)");

  const looksMalformed = looksLikeMalformedDeliveryWithParsed(
    messageText,
    deliveryData
  );
  let savedViaAi = false;

  // ── AI fallback ─────────────────────────────────────────────────────────
  if (looksMalformed && config.AI_DELIVERY_FALLBACK_ENABLED && config.OPENAI_API_KEY) {
    try {
      const existingByMsg = await findDeliveryByMessageId(whatsappMessageId);
      if (existingByMsg) {
        console.log(
          `   ⏭️  AI fallback skipped — delivery already exists for message id=${existingByMsg.id}`
        );
      } else {
        console.log("   🤖 AI delivery fallback: calling OpenAI…");
        const aiResult = await extractDeliveryWithAI(messageText, config);

        if (!aiResult.ok) {
          console.log("   ⚠️  AI extraction failed:", aiResult.error || "unknown");
          if (aiResult.error !== "timeout") {
            botAlerts.notifyMessageError(
              new Error(`AI extraction failed: ${aiResult.error}`),
              "ai-delivery-fallback"
            );
          }
        } else {
          const normalized = validateAndNormalizeAiDelivery(aiResult.raw, messageText);
          if (!normalized) {
            console.log(
              "   ⚠️  AI extraction did not pass validation (phone/amount mismatch)"
            );
          } else {
            try {
              console.log(`   💾 Storing WhatsApp message ID: ${whatsappMessageId}`);
              const deliveryId = await createDelivery({
                phone: normalized.phone,
                customer_name: null,
                items: normalized.items,
                amount_due: normalized.amount_due,
                quartier: normalized.quartier,
                carrier: normalized.carrier,
                notes: `AI fallback | Original: ${messageText.substring(0, 100)}`,
                group_id: group ? group.id : null,
                agency_id: agencyId,
                whatsapp_message_id: whatsappMessageId,
              });
              savedViaAi = true;

              console.log("\n" + "=".repeat(60));
              console.log(`   ✅ LIVRAISON #${deliveryId} ENREGISTRÉE (AI fallback)`);
              console.log("=".repeat(60));
              console.log(`   📱 Numéro: ${normalized.phone}`);
              console.log(`   📦 Produits: ${normalized.items}`);
              console.log(`   💰 Montant: ${normalized.amount_due} FCFA`);
              console.log(`   📍 Quartier: ${normalized.quartier || "Non spécifié"}`);
              console.log("=".repeat(60) + "\n");

              if (config.SEND_CONFIRMATIONS === "true" && config.GROUP_ID) {
                try {
                  const confirmMsg =
                    `✅ Livraison #${deliveryId} enregistrée (saisie assistée)\n` +
                    `📱 ${normalized.phone}\n` +
                    `📦 ${normalized.items}\n` +
                    `💰 ${normalized.amount_due} FCFA`;
                  const chat = await client.getChatById(config.GROUP_ID);
                  await chat.sendMessage(confirmMsg);
                } catch {
                  console.log("   ⚠️  Could not send confirmation message");
                }
              }
            } catch (dbAiError) {
              console.error("   ❌ Erreur lors de la sauvegarde (AI):", dbAiError.message);
              botAlerts.notifyDeliverySaveFailed(dbAiError.message);
            }
          }
        }
      }
    } catch (aiErr) {
      console.error("   ❌ AI fallback error:", aiErr.message);
      botAlerts.notifyMessageError(aiErr, "ai-delivery-fallback");
    }
  } else if (looksMalformed && config.AI_DELIVERY_FALLBACK_ENABLED) {
    console.log("   💡 AI fallback enabled but OPENAI_API_KEY missing — skipping");
  }

  // ── Format reminder ─────────────────────────────────────────────────────
  if (!savedViaAi && looksMalformed) {
    if (!config.FORMAT_REMINDER_ENABLED) {
      console.log(
        "   💡 Message matches format-reminder heuristics; set FORMAT_REMINDER_ENABLED=true in .env to reply in-thread"
      );
      return;
    }

    const author = msg.author || msg.from || "unknown";
    const cooldownKey = `${whatsappGroupId}:${author}`;
    const now = Date.now();
    const lastSent = formatReminderCooldownByKey.get(cooldownKey) || 0;

    if (now - lastSent < config.FORMAT_REMINDER_COOLDOWN_MS) {
      console.log("   ⏭️  Format reminder skipped (cooldown)");
      return;
    }

    try {
      await msg.reply(getFormatReminderMessage());
      formatReminderCooldownByKey.set(cooldownKey, now);
      console.log("   📤  Format reminder sent (reply)");
    } catch (reminderErr) {
      console.log("   ⚠️  Could not send format reminder:", reminderErr.message);
      botAlerts.notifyMessageError(reminderErr, `format-reminder:${author}`);
    }
  }
}

module.exports = { handleDelivery };
