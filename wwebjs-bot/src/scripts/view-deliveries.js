const { getTodayDeliveries, getDeliveryStats, close } = require("../db");

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("📦 LIVRAISONS ENREGISTRÉES");
  console.log("=".repeat(60) + "\n");

  // Get today's deliveries
  const deliveries = await getTodayDeliveries();
  const stats = await getDeliveryStats();

if (deliveries.length === 0) {
  console.log("Aucune livraison enregistrée aujourd'hui.\n");
} else {
  console.log(`📊 Statistiques du jour:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   Livrées: ${stats.delivered || 0}`);
  console.log(`   En attente: ${stats.pending || 0}`);
  console.log(`   Échecs: ${stats.failed || 0}`);
  console.log(`   Collecté: ${stats.total_collected || 0} FCFA`);
  console.log(`   Restant: ${stats.total_remaining || 0} FCFA\n`);

  console.log(`📋 Liste des livraisons (${deliveries.length}):\n`);

  deliveries.forEach((delivery, index) => {
    console.log(`${index + 1}. Livraison #${delivery.id}`);
    console.log(`   📱 Numéro: ${delivery.phone}`);
    if (delivery.customer_name) {
      console.log(`   👤 Client: ${delivery.customer_name}`);
    }
    console.log(`   📦 Produits: ${delivery.items}`);
    console.log(`   💰 Montant: ${delivery.amount_due} FCFA`);
    if (delivery.amount_paid > 0) {
      console.log(`   ✅ Payé: ${delivery.amount_paid} FCFA`);
    }
    console.log(`   📍 Quartier: ${delivery.quartier || "Non spécifié"}`);
    console.log(`   📊 Statut: ${delivery.status}`);
    if (delivery.carrier) {
      console.log(`   🚚 Transporteur: ${delivery.carrier}`);
    }
    console.log(
      `   🕐 Créé: ${new Date(delivery.created_at).toLocaleString("fr-FR")}`
    );
    console.log("");
  });
}

  console.log("=".repeat(60) + "\n");

  // Close database connection
  await close();
}

main().catch(console.error);

