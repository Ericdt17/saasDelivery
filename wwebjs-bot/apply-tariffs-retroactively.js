/**
 * Script pour appliquer rétroactivement les tarifs aux livraisons livrées
 * qui n'ont pas encore de delivery_fee
 */

const db = require('./src/db');

async function applyTariffsRetroactively() {
  try {
    console.log('\n=== Application rétroactive des tarifs ===\n');

    // Get all delivered deliveries without delivery_fee
    const allDeliveries = await db.getDeliveries({
      status: 'delivered',
      page: 1,
      limit: 1000,
    });

    const deliveries = allDeliveries.deliveries || [];
    console.log(`Nombre de livraisons livrées à vérifier: ${deliveries.length}\n`);

    let applied = 0;
    let skipped = 0;
    let errors = 0;

    for (const delivery of deliveries) {
      // Skip if delivery_fee is already set and > 0
      if (delivery.delivery_fee && delivery.delivery_fee > 0) {
        skipped++;
        continue;
      }

      // Skip if no quartier or agency_id
      if (!delivery.quartier || !delivery.agency_id) {
        console.log(`⚠️  Livraison ID ${delivery.id}: Informations manquantes (quartier ou agency_id)`);
        skipped++;
        continue;
      }

      try {
        // Find tariff for this agency and quartier
        const tariffResult = await db.getTariffByAgencyAndQuartier(
          delivery.agency_id,
          delivery.quartier
        );
        const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;

        if (!tariff || !tariff.tarif_amount) {
          console.log(`❌ Livraison ID ${delivery.id} (${delivery.quartier}): Aucun tarif trouvé`);
          skipped++;
          continue;
        }

        const tariffAmount = parseFloat(tariff.tarif_amount) || 0;

        // Calculate new amount_paid (subtract tariff from current amount_paid)
        const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
        const newAmountPaid = Math.max(0, Math.round((currentAmountPaid - tariffAmount) * 100) / 100);

        // Update delivery with delivery_fee and new amount_paid
        await db.updateDelivery(delivery.id, {
          delivery_fee: tariffAmount,
          amount_paid: newAmountPaid,
        });

        console.log(`✅ Livraison ID ${delivery.id} (${delivery.quartier}): Tarif ${tariffAmount} FCFA appliqué`);
        console.log(`   Montant encaissé: ${currentAmountPaid} -> ${newAmountPaid} FCFA`);
        applied++;
      } catch (error) {
        console.error(`❌ Erreur pour livraison ID ${delivery.id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n=== Résumé ===`);
    console.log(`✅ Tarifs appliqués: ${applied}`);
    console.log(`⏭️  Ignorées: ${skipped}`);
    console.log(`❌ Erreurs: ${errors}`);
    console.log(`\n`);

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyTariffsRetroactively();










