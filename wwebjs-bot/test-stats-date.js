/**
 * Script de test pour vérifier la gestion des dates dans les statistiques
 *
 * Usage: node test-stats-date.js [date]
 * Exemple: node test-stats-date.js 2025-12-08
 */

const config = require("./src/config");
const { getDeliveryStats } = require("./src/db");

async function testStatsDate(testDate) {
  console.log("\n🧪 Test des statistiques pour la date:", testDate);
  console.log("=".repeat(60));

  try {
    // Test 1: Vérifier le format de la date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(testDate)) {
      console.error("❌ Format de date invalide. Format attendu: YYYY-MM-DD");
      return;
    }
    console.log("✅ Format de date valide:", testDate);

    // Test 2: Appeler getDeliveryStats avec la date
    console.log("\n📊 Appel de getDeliveryStats avec date:", testDate);
    const stats = await getDeliveryStats(testDate);

    // Test 3: Vérifier que toutes les valeurs sont des nombres (pas null/undefined)
    console.log("\n📈 Résultats:");
    console.log("  - total:", stats.total, typeof stats.total);
    console.log("  - delivered:", stats.delivered, typeof stats.delivered);
    console.log("  - failed:", stats.failed, typeof stats.failed);
    console.log("  - pending:", stats.pending, typeof stats.pending);
    console.log("  - pickup:", stats.pickup, typeof stats.pickup);
    console.log(
      "  - total_collected:",
      stats.total_collected,
      typeof stats.total_collected
    );
    console.log(
      "  - total_remaining:",
      stats.total_remaining,
      typeof stats.total_remaining
    );

    // Test 4: Vérifier que toutes les valeurs sont >= 0
    const allValues = [
      stats.total,
      stats.delivered,
      stats.failed,
      stats.pending,
      stats.pickup,
      stats.total_collected,
      stats.total_remaining,
    ];

    const hasNegative = allValues.some((v) => v < 0);
    const hasNull = allValues.some((v) => v === null || v === undefined);
    const hasNaN = allValues.some((v) => isNaN(v));

    if (hasNegative) {
      console.error("❌ Certaines valeurs sont négatives!");
    } else {
      console.log("✅ Toutes les valeurs sont >= 0");
    }

    if (hasNull) {
      console.error("❌ Certaines valeurs sont null ou undefined!");
    } else {
      console.log("✅ Aucune valeur null/undefined");
    }

    if (hasNaN) {
      console.error("❌ Certaines valeurs sont NaN!");
    } else {
      console.log("✅ Toutes les valeurs sont des nombres valides");
    }

    // Test 5: Si total = 0, vérifier que toutes les autres valeurs sont aussi 0
    if (stats.total === 0) {
      const allZero = allValues.every((v) => v === 0);
      if (allZero) {
        console.log(
          "✅ Cohérence: total = 0, toutes les autres valeurs sont aussi 0"
        );
      } else {
        console.error(
          "❌ Incohérence: total = 0 mais certaines valeurs ne sont pas 0!"
        );
        console.error(
          "   Cela indique un problème dans la requête SQL ou le traitement des résultats"
        );
      }
    } else {
      console.log("✅ Des livraisons existent pour cette date (total > 0)");
    }

    // Test 6: Test avec date null (devrait retourner les stats d'aujourd'hui)
    console.log("\n📅 Test avec date = null (stats du jour):");
    const todayStats = await getDeliveryStats(null);
    console.log("  - total aujourd'hui:", todayStats.total);
    console.log("  - total_collected aujourd'hui:", todayStats.total_collected);

    // Test 7: Comparer avec la date testée
    const today = new Date().toISOString().split("T")[0];
    if (testDate === today) {
      console.log("\n📊 Comparaison avec les stats du jour:");
      if (stats.total === todayStats.total) {
        console.log("✅ Les stats correspondent (même date)");
      } else {
        console.warn(
          "⚠️  Les stats ne correspondent pas. Possible problème de timezone?"
        );
        console.warn("   Stats avec date explicite:", stats.total);
        console.warn("   Stats avec date null:", todayStats.total);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Tests terminés");
  } catch (error) {
    console.error("\n❌ Erreur lors du test:");
    console.error(error);
    process.exit(1);
  }
}

// Récupérer la date depuis les arguments ou utiliser aujourd'hui
const testDate = process.argv[2] || new Date().toISOString().split("T")[0];

console.log("🔍 Configuration:");
console.log("  - DB_TYPE:", config.DB_TYPE);
console.log("  - Date à tester:", testDate);
console.log("  - Date du serveur:", new Date().toISOString());
console.log(
  "  - Timezone du serveur:",
  Intl.DateTimeFormat().resolvedOptions().timeZone
);

testStatsDate(testDate)
  .then(() => {
    console.log("\n✨ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erreur fatale:", error);
    process.exit(1);
  });




