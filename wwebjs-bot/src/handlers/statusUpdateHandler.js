"use strict";

const {
  updateDelivery,
  addHistory,
  getTariffByAgencyAndQuartier,
} = require("../db");
const {
  computeAmountPaidAfterFee,
  roundAmount,
} = require("../lib/deliveryCalculations");

/**
 * Apply tariff to a delivery during a status update.
 * @param {object} delivery
 * @param {object} updateData  - mutated in place
 * @param {number|null} agencyId
 * @param {boolean} forceAmountPaidToZero - true for client_absent/no_answer/unreachable
 */
async function applyTariffForStatusUpdate(
  delivery,
  updateData,
  agencyId,
  forceAmountPaidToZero = false
) {
  if (!agencyId || !delivery.quartier) {
    console.log(`   ⚠️  Cannot apply tariff: agency_id or quartier missing`);
    return;
  }

  const currentDeliveryFee = delivery.delivery_fee || 0;
  if (currentDeliveryFee > 0) {
    if (forceAmountPaidToZero) {
      updateData.amount_paid = 0;
      console.log(
        `   💰 Tariff already applied (${currentDeliveryFee}), amount_paid forced to 0`
      );
    } else {
      console.log(`   💰 Tariff already applied (${currentDeliveryFee})`);
    }
    return;
  }

  try {
    const tariffResult = await getTariffByAgencyAndQuartier(
      agencyId,
      delivery.quartier
    );
    const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;

    if (!tariff || !tariff.tarif_amount) {
      console.log(
        `   ⚠️  No tariff found for quartier "${delivery.quartier}", status change allowed without tariff`
      );
      if (forceAmountPaidToZero) updateData.amount_paid = 0;
      return;
    }

    const tariffAmount = parseFloat(tariff.tarif_amount) || 0;
    updateData.delivery_fee = tariffAmount;

    if (forceAmountPaidToZero) {
      updateData.amount_paid = 0;
      console.log(
        `   💰 Applied automatic tariff: ${tariffAmount} FCFA for quartier "${delivery.quartier}", amount_paid forced to 0`
      );
    } else {
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
    if (forceAmountPaidToZero) updateData.amount_paid = 0;
  }
}

/**
 * Execute a status update for a delivery.
 *
 * @param {{
 *   delivery: object,
 *   statusData: object,
 *   agencyId: number|null,
 *   contactName: string,
 *   deliveryFromReply: object|null,
 *   quotedMessage: object|null,
 * }} ctx
 */
async function handleStatusUpdate({
  delivery,
  statusData,
  agencyId,
  contactName,
  deliveryFromReply,
  quotedMessage,
}) {
  if (!delivery || !statusData) {
    if (deliveryFromReply) {
      console.log(
        `   ⚠️  Réponse détectée mais aucune donnée de statut valide trouvée`
      );
    } else if (statusData && statusData.phone) {
      console.log(
        `   ⚠️  Aucune livraison trouvée pour le numéro: ${statusData.phone}`
      );
      console.log(`   💡 Créez d'abord la livraison avec le format standard`);
    } else if (!statusData) {
      console.log(
        "   ⚠️  Message de réponse détecté mais format de statut non reconnu"
      );
    } else {
      console.log(
        "   ⚠️  Numéro de téléphone non trouvé dans le message de statut"
      );
    }
    return;
  }

  try {
    let updateData = {};
    let historyAction = "";

    switch (statusData.type) {
      case "delivered":
        updateData.status = "delivered";
        historyAction = "marked_delivered";
        console.log(`   ✅ Livraison #${delivery.id} marquée comme LIVRÉE`);
        await applyTariffForStatusUpdate(delivery, updateData, agencyId, false);
        break;

      case "client_absent":
        updateData.status = "client_absent";
        historyAction = "marked_client_absent";
        console.log(
          `   ⚠️  Livraison #${delivery.id} marquée comme CLIENT ABSENT`
        );
        await applyTariffForStatusUpdate(delivery, updateData, agencyId, true);
        break;

      case "failed": {
        updateData.status = "failed";
        historyAction = "marked_failed";
        console.log(`   ❌ Livraison #${delivery.id} marquée comme ÉCHEC`);
        updateData.delivery_fee = 0;
        const paidFailed = parseFloat(delivery.amount_paid) || 0;
        if (paidFailed > 0) {
          updateData.amount_paid = 0;
          console.log(`   💰 Remboursement de ${paidFailed} F (amount_paid mis à 0)`);
        }
        console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
        break;
      }

      case "postponed": {
        updateData.status = "postponed";
        historyAction = "marked_postponed";
        console.log(`   🔄 Livraison #${delivery.id} marquée comme RENVOYÉE`);
        updateData.delivery_fee = 0;
        const paidPostponed = parseFloat(delivery.amount_paid) || 0;
        if (paidPostponed > 0) {
          updateData.amount_paid = 0;
          console.log(`   💰 Remboursement de ${paidPostponed} F (amount_paid mis à 0)`);
        }
        console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
        break;
      }

      case "no_answer": {
        updateData.status = "no_answer";
        historyAction = "marked_no_answer";
        console.log(
          `   📵 Livraison #${delivery.id} marquée comme NE DÉCROCHE PAS`
        );
        updateData.delivery_fee = 0;
        const paidNoAnswer = parseFloat(delivery.amount_paid) || 0;
        if (paidNoAnswer > 0) {
          updateData.amount_paid = 0;
          console.log(`   💰 Remboursement de ${paidNoAnswer} F (amount_paid mis à 0)`);
        }
        console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
        break;
      }

      case "unreachable": {
        updateData.status = "unreachable";
        historyAction = "marked_unreachable";
        console.log(
          `   📵 Livraison #${delivery.id} marquée comme INJOIGNABLE`
        );
        updateData.delivery_fee = 0;
        const paidUnreachable = parseFloat(delivery.amount_paid) || 0;
        if (paidUnreachable > 0) {
          updateData.amount_paid = 0;
          console.log(`   💰 Remboursement de ${paidUnreachable} F (amount_paid mis à 0)`);
        }
        console.log(`   🚫 Tarif annulé (delivery_fee mis à 0)`);
        break;
      }

      case "payment": {
        const currentAmountPaid = roundAmount(
          parseFloat(delivery.amount_paid) || 0
        );
        const currentAmountDue = roundAmount(
          parseFloat(delivery.amount_due) || 0
        );
        let paymentAmount = roundAmount(parseFloat(statusData.amount) || 0);
        if (!paymentAmount) {
          const remaining = currentAmountDue - currentAmountPaid;
          paymentAmount = roundAmount(remaining > 0 ? remaining : currentAmountDue);
          console.log(
            `   💡 Montant non spécifié, utilisation du montant restant: ${paymentAmount} FCFA`
          );
        }
        const newAmountPaid = roundAmount(currentAmountPaid + paymentAmount);
        updateData.amount_paid = newAmountPaid;
        historyAction = "payment_collected";
        console.log(`   💰 Paiement collecté: ${paymentAmount} FCFA`);
        console.log(
          `   💵 Total payé: ${newAmountPaid} FCFA / ${currentAmountDue} FCFA`
        );
        if (newAmountPaid >= currentAmountDue) {
          updateData.status = "delivered";
          console.log(`   ✅ Livraison complètement payée - marquée comme LIVRÉE`);
          await applyTariffForStatusUpdate(delivery, updateData, agencyId, false);
        }
        break;
      }

      case "pickup": {
        updateData.status = "pickup";
        historyAction = "marked_pickup";
        console.log(`   📦 Livraison #${delivery.id} marquée comme AU BUREAU`);
        const pickupTariff = 1000;
        const currentFeePickup = delivery.delivery_fee || 0;
        if (currentFeePickup > 0) {
          updateData.delivery_fee = currentFeePickup;
          console.log(`   💰 Tariff already applied (${currentFeePickup})`);
        } else {
          updateData.delivery_fee = pickupTariff;
          const paidPickup = parseFloat(delivery.amount_paid) || 0;
          const duePickup = parseFloat(delivery.amount_due) || 0;
          const newPaid = computeAmountPaidAfterFee(
            paidPickup === 0 ? duePickup : paidPickup,
            pickupTariff
          );
          updateData.amount_paid = newPaid;
          console.log(
            `   💰 Applied fixed pickup tariff: ${pickupTariff} FCFA (Au bureau)`
          );
        }
        break;
      }

      case "pending":
        updateData.status = "pending";
        historyAction = "marked_pending";
        console.log(`   ⏳ Livraison #${delivery.id} marquée comme EN ATTENTE`);
        break;

      case "modify":
        if (statusData.items) updateData.items = statusData.items;
        if (statusData.amount) updateData.amount_due = statusData.amount;
        historyAction = "modified";
        console.log(`   ✏️  Livraison #${delivery.id} MODIFIÉE`);
        if (statusData.items) console.log(`   📦 Nouveaux produits: ${statusData.items}`);
        if (statusData.amount) console.log(`   💰 Nouveau montant: ${statusData.amount} FCFA`);
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

    if (Object.keys(updateData).length === 0) return;

    await updateDelivery(delivery.id, updateData);
    const via = deliveryFromReply && quotedMessage ? "via message ID" : "via numéro de téléphone";
    console.log(`   ✅ Mise à jour de la livraison #${delivery.id} ${via}`);

    await addHistory(
      delivery.id,
      historyAction || statusData.type,
      JSON.stringify({ ...statusData, updated_by: contactName })
    );

    console.log("\n" + "=".repeat(60));
    console.log(`   ✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅`);
    console.log("=".repeat(60));
    console.log(`   📦 Livraison #${delivery.id}`);
    console.log(`   📱 Numéro: ${delivery.phone}`);
    console.log(`   📊 Type: ${statusData.type}`);
    if (statusData.amount) console.log(`   💰 Montant: ${statusData.amount} FCFA`);
    console.log(`   ✅ Statut mis à jour dans la base de données`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("   ❌ Erreur lors de la mise à jour:", error.message);
  }
}

module.exports = { handleStatusUpdate };
