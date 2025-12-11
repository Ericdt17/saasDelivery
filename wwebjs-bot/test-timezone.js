/**
 * Script de test pour vérifier la gestion du fuseau horaire
 *
 * Usage: node test-timezone.js
 */

const config = require("./src/config");
const { initDatabase } = require("./src/db-adapter");
const adapter = initDatabase();

async function testTimezone() {
  console.log("\n🌍 Test de la gestion du fuseau horaire");
  console.log("=".repeat(60));

  try {
    // Test 1: Timezone du système Node.js
    console.log("\n📅 Test 1: Timezone du serveur Node.js");
    const nodeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nodeNow = new Date();
    const nodeDateStr = nodeNow.toISOString();
    const nodeLocalDateStr = nodeNow.toLocaleDateString("fr-FR", {
      timeZone: nodeTimezone,
    });

    console.log(`   Timezone: ${nodeTimezone}`);
    console.log(`   Date/heure actuelle (ISO): ${nodeDateStr}`);
    console.log(`   Date locale: ${nodeLocalDateStr}`);
    console.log(`   Offset UTC: ${-nodeNow.getTimezoneOffset() / 60} heures`);

    // Test 2: Timezone de la base de données
    console.log("\n🗄️  Test 2: Timezone de la base de données");
    console.log(`   Type de DB: ${config.DB_TYPE}`);

    if (config.DB_TYPE === "postgres") {
      // Test PostgreSQL timezone
      const pgTimezoneResult = await adapter.query("SHOW timezone");
      const pgTimezone = Array.isArray(pgTimezoneResult)
        ? pgTimezoneResult[0]?.timezone || pgTimezoneResult[0]
        : pgTimezoneResult;

      console.log(`   PostgreSQL timezone: ${pgTimezone}`);

      const pgNowResult = await adapter.query(
        "SELECT NOW() as now, CURRENT_DATE as current_date, CURRENT_TIMESTAMP as current_timestamp"
      );
      const pgNow = Array.isArray(pgNowResult) ? pgNowResult[0] : pgNowResult;

      console.log(`   PostgreSQL NOW(): ${pgNow?.now}`);
      console.log(`   PostgreSQL CURRENT_DATE: ${pgNow?.current_date}`);
      console.log(
        `   PostgreSQL CURRENT_TIMESTAMP: ${pgNow?.current_timestamp}`
      );

      // Test avec une date spécifique
      const testDate = "2025-12-08";
      const pgDateTest = await adapter.query(
        "SELECT $1::date as input_date, CURRENT_DATE as server_date, ($1::date = CURRENT_DATE) as matches_today",
        [testDate]
      );
      const pgDateResult = Array.isArray(pgDateTest)
        ? pgDateTest[0]
        : pgDateTest;
      console.log(`   Test avec date '${testDate}':`);
      console.log(`     Date serveur: ${pgDateResult?.server_date}`);
      console.log(
        `     Correspond à aujourd'hui: ${pgDateResult?.matches_today}`
      );
    } else {
      // Test SQLite
      const sqliteNowResult = await adapter.query(
        "SELECT datetime('now') as now, date('now') as current_date, datetime('now', 'localtime') as local_now"
      );
      const sqliteNow = Array.isArray(sqliteNowResult)
        ? sqliteNowResult[0]
        : sqliteNowResult;

      console.log(`   SQLite datetime('now'): ${sqliteNow?.now}`);
      console.log(`   SQLite date('now'): ${sqliteNow?.current_date}`);
      console.log(
        `   SQLite datetime('now', 'localtime'): ${sqliteNow?.local_now}`
      );

      // Test avec une date spécifique
      const testDate = "2025-12-08";
      const sqliteDateTest = await adapter.query(
        "SELECT date(?) as input_date, date('now') as server_date, (date(?) = date('now')) as matches_today",
        [testDate, testDate]
      );
      const sqliteDateResult = Array.isArray(sqliteDateTest)
        ? sqliteDateTest[0]
        : sqliteDateTest;
      console.log(`   Test avec date '${testDate}':`);
      console.log(`     Date serveur: ${sqliteDateResult?.server_date}`);
      console.log(
        `     Correspond à aujourd'hui: ${sqliteDateResult?.matches_today}`
      );
    }

    // Test 3: Comparaison avec une date du frontend
    console.log("\n🔄 Test 3: Comparaison Frontend vs Backend");
    const frontendDate = new Date();
    frontendDate.setHours(0, 0, 0, 0);
    const frontendDateStr = frontendDate.toISOString().split("T")[0];

    // Format local (comme le frontend le fait maintenant)
    const year = frontendDate.getFullYear();
    const month = String(frontendDate.getMonth() + 1).padStart(2, "0");
    const day = String(frontendDate.getDate()).padStart(2, "0");
    const frontendLocalDateStr = `${year}-${month}-${day}`;

    console.log(`   Frontend date (UTC via toISOString): ${frontendDateStr}`);
    console.log(`   Frontend date (locale): ${frontendLocalDateStr}`);

    // Test avec getDeliveryStats
    const { getDeliveryStats } = require("./src/db");
    const statsWithLocalDate = await getDeliveryStats(frontendLocalDateStr);
    const statsWithUtcDate = await getDeliveryStats(frontendDateStr);

    console.log(
      `   Stats avec date locale (${frontendLocalDateStr}): ${statsWithLocalDate.total} livraisons`
    );
    console.log(
      `   Stats avec date UTC (${frontendDateStr}): ${statsWithUtcDate.total} livraisons`
    );

    if (
      statsWithLocalDate.total !== statsWithUtcDate.total &&
      frontendDateStr !== frontendLocalDateStr
    ) {
      console.log(
        `   ⚠️  ATTENTION: Différence détectée entre date locale et UTC!`
      );
    }

    // Test 4: Vérifier une livraison existante
    console.log("\n📦 Test 4: Vérification d'une livraison existante");
    const sampleDelivery = await adapter.query(
      config.DB_TYPE === "postgres"
        ? "SELECT id, created_at, created_at::date as date_only FROM deliveries ORDER BY created_at DESC LIMIT 1"
        : "SELECT id, created_at, DATE(created_at) as date_only FROM deliveries ORDER BY created_at DESC LIMIT 1"
    );

    if (
      sampleDelivery &&
      (Array.isArray(sampleDelivery)
        ? sampleDelivery.length > 0
        : sampleDelivery.id)
    ) {
      const delivery = Array.isArray(sampleDelivery)
        ? sampleDelivery[0]
        : sampleDelivery;
      console.log(`   Dernière livraison:`);
      console.log(`     ID: ${delivery.id}`);
      console.log(`     created_at (complet): ${delivery.created_at}`);
      console.log(`     created_at (date seulement): ${delivery.date_only}`);

      // Comparer avec la date d'aujourd'hui
      const todayLocal = frontendLocalDateStr;
      const matchesToday = delivery.date_only === todayLocal;
      console.log(`     Date d'aujourd'hui (locale): ${todayLocal}`);
      console.log(
        `     Correspond à aujourd'hui: ${matchesToday ? "✅ Oui" : "❌ Non"}`
      );
    } else {
      console.log(`   Aucune livraison trouvée dans la base de données`);
    }

    // Test 5: Résumé et recommandations
    console.log("\n📊 Résumé:");
    console.log("=".repeat(60));
    console.log(`   Timezone Node.js: ${nodeTimezone}`);
    if (config.DB_TYPE === "postgres") {
      const pgTz = await adapter.query("SHOW timezone");
      const tz = Array.isArray(pgTz) ? pgTz[0]?.timezone || pgTz[0] : pgTz;
      console.log(`   Timezone PostgreSQL: ${tz}`);

      if (nodeTimezone !== tz) {
        console.log(
          `   ⚠️  ATTENTION: Timezone différent entre Node.js et PostgreSQL!`
        );
      }
    }

    console.log("\n✅ Tests terminés");
  } catch (error) {
    console.error("\n❌ Erreur lors du test:");
    console.error(error);
    process.exit(1);
  } finally {
    await adapter.close();
  }
}

testTimezone()
  .then(() => {
    console.log("\n✨ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erreur fatale:", error);
    process.exit(1);
  });
