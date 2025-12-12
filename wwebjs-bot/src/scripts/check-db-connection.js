/**
 * Script pour vérifier la connexion à la base de données
 * Affiche le type de base de données utilisée et teste la connexion
 */

require("dotenv").config();
const db = require("../db");

async function checkConnection() {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 VÉRIFICATION DE LA CONNEXION À LA BASE DE DONNÉES");
  console.log("=".repeat(60) + "\n");

  // Afficher le type de base de données
  console.log(`📊 Type de base de données: ${db.adapter.type.toUpperCase()}\n`);

  // Afficher les variables d'environnement (masquées)
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const dbType = process.env.DB_TYPE || "sqlite";
  const nodeEnv = process.env.NODE_ENV || "development";

  console.log("📋 Configuration:");
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   DB_TYPE: ${dbType}`);
  console.log(`   DATABASE_URL: ${hasDatabaseUrl ? "✅ Défini" : "❌ Non défini"}`);

  if (hasDatabaseUrl) {
    const maskedUrl = process.env.DATABASE_URL.replace(
      /:[^:@]+@/,
      ":****@"
    );
    console.log(`   URL: ${maskedUrl}`);
  } else {
    console.log(`   DB_PATH: ${process.env.DB_PATH || "data/bot.db"}`);
  }
  console.log();

  // Tester la connexion
  try {
    console.log("🔌 Test de connexion...\n");

    if (db.adapter.type === "postgres") {
      // Test PostgreSQL
      const result = await db.adapter.query(
        "SELECT version(), current_database(), current_user, current_timestamp"
      );
      console.log("✅ Connexion PostgreSQL réussie!\n");
      console.log("📊 Informations de la base de données:");
      // La fonction query retourne directement les rows pour SELECT
      const row = Array.isArray(result) ? result[0] : (result?.rows?.[0] || result);
      if (row) {
        console.log(`   Base de données: ${row.current_database}`);
        console.log(`   Utilisateur: ${row.current_user}`);
        console.log(`   Version: ${row.version.split(",")[0]}`);
        console.log(`   Heure serveur: ${row.current_timestamp}`);
      } else {
        console.log(`   ⚠️  Impossible de récupérer les informations`);
      }

      // Vérifier les tables
      console.log("\n📋 Vérification des tables...");
      const tablesResult = await db.adapter.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const tables = Array.isArray(tablesResult) 
        ? tablesResult.map((r) => r.table_name)
        : (tablesResult?.rows?.map((r) => r.table_name) || []);
      const requiredTables = ["agencies", "groups", "deliveries", "delivery_history"];

      console.log(`   Tables trouvées: ${tables.length}`);
      for (const table of requiredTables) {
        if (tables.includes(table)) {
          console.log(`   ✅ ${table}`);
        } else {
          console.log(`   ❌ ${table} (MANQUANTE)`);
        }
      }

      // Compter les enregistrements
      console.log("\n📊 Statistiques:");
      try {
        const stats = await db.query(`
          SELECT 
            (SELECT COUNT(*) FROM agencies) as agencies,
            (SELECT COUNT(*) FROM groups) as groups,
            (SELECT COUNT(*) FROM deliveries) as deliveries,
            (SELECT COUNT(*) FROM delivery_history) as history
        `);
        console.log(`   Agencies: ${stats.rows[0].agencies}`);
        console.log(`   Groups: ${stats.rows[0].groups}`);
        console.log(`   Deliveries: ${stats.rows[0].deliveries}`);
        console.log(`   History: ${stats.rows[0].history}`);
      } catch (statsError) {
        console.log(`   ⚠️  Impossible de récupérer les statistiques: ${statsError.message}`);
      }
    } else {
      // Test SQLite
      const result = await db.adapter.query("SELECT sqlite_version() as version, datetime('now') as current_time");
      console.log("✅ Connexion SQLite réussie!\n");
      console.log("📊 Informations de la base de données:");
      console.log(`   Version SQLite: ${result.rows[0].version}`);
      console.log(`   Heure locale: ${result.rows[0].current_time}`);
      console.log(`   Fichier: ${process.env.DB_PATH || "data/bot.db"}`);

      // Vérifier les tables
      console.log("\n📋 Vérification des tables...");
      const tablesResult = await db.adapter.query(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      const tables = tablesResult.rows.map((r) => r.name);
      const requiredTables = ["agencies", "groups", "deliveries", "delivery_history"];

      console.log(`   Tables trouvées: ${tables.length}`);
      for (const table of requiredTables) {
        if (tables.includes(table)) {
          console.log(`   ✅ ${table}`);
        } else {
          console.log(`   ❌ ${table} (MANQUANTE)`);
        }
      }

      // Compter les enregistrements
      console.log("\n📊 Statistiques:");
      try {
        const stats = await db.query(`
          SELECT 
            (SELECT COUNT(*) FROM agencies) as agencies,
            (SELECT COUNT(*) FROM groups) as groups,
            (SELECT COUNT(*) FROM deliveries) as deliveries,
            (SELECT COUNT(*) FROM delivery_history) as history
        `);
        console.log(`   Agencies: ${stats.rows[0].agencies}`);
        console.log(`   Groups: ${stats.rows[0].groups}`);
        console.log(`   Deliveries: ${stats.rows[0].deliveries}`);
        console.log(`   History: ${stats.rows[0].history}`);
      } catch (statsError) {
        console.log(`   ⚠️  Impossible de récupérer les statistiques: ${statsError.message}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ VÉRIFICATION TERMINÉE");
    console.log("=".repeat(60) + "\n");

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erreur de connexion:");
    console.error(`   ${error.message}\n`);
    console.log("💡 Vérifiez:");
    console.log("   1. Que DATABASE_URL est correctement défini dans .env");
    console.log("   2. Que la base de données est accessible");
    console.log("   3. Que les tables existent (exécutez create-postgres-tables.js si nécessaire)\n");

    await db.close().catch(() => {});
    process.exit(1);
  }
}

checkConnection();

