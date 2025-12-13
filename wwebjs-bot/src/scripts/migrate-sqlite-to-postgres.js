/**
 * Script de migration SQLite vers PostgreSQL
 * Transfère toutes les données de SQLite locale vers PostgreSQL dev
 * 
 * Usage:
 * 1. Créez un fichier .env.migration dans wwebjs-bot/ avec:
 *    DB_TYPE=sqlite (pour lire SQLite)
 *    DATABASE_URL=<postgres-external-url> (pour écrire PostgreSQL)
 * 
 * 2. Exécutez: node src/scripts/migrate-sqlite-to-postgres.js
 */

require("dotenv").config({ path: ".env.migration" });
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const path = require("path");
const config = require("../config");

// Configuration SQLite (source)
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "..", "data", "bot.db");

// Configuration PostgreSQL (destination)
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("❌ Erreur: DATABASE_URL ou POSTGRES_URL doit être défini");
  console.error("💡 Créez un fichier .env.migration avec:");
  console.error("   DATABASE_URL=postgresql://user:password@host:5432/database");
  process.exit(1);
}

// Connexions
let sqliteDb;
let postgresPool;

async function initConnections() {
  console.log("🔌 Connexion aux bases de données...\n");
  
  // SQLite
  try {
    sqliteDb = new Database(SQLITE_DB_PATH);
    console.log(`✅ SQLite connecté: ${SQLITE_DB_PATH}`);
  } catch (error) {
    console.error(`❌ Erreur connexion SQLite: ${error.message}`);
    process.exit(1);
  }
  
  // PostgreSQL
  try {
    postgresPool = new Pool({
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    });
    await postgresPool.query("SELECT 1");
    console.log(`✅ PostgreSQL connecté\n`);
  } catch (error) {
    console.error(`❌ Erreur connexion PostgreSQL: ${error.message}`);
    console.error("💡 Vérifiez votre DATABASE_URL (External Database URL de Render)");
    process.exit(1);
  }
}

async function migrateAgencies() {
  console.log("📦 Migration des agencies...");
  
  const agencies = sqliteDb.prepare("SELECT * FROM agencies").all();
  console.log(`   Trouvé ${agencies.length} agencies`);
  
  if (agencies.length === 0) {
    console.log("   ⚠️  Aucune agency à migrer\n");
    return {};
  }
  
  const idMap = {}; // Map SQLite ID -> PostgreSQL ID
  
  for (const agency of agencies) {
    try {
      // Convertir is_active: INTEGER (0/1) -> BOOLEAN
      const isActive = agency.is_active === 1 || agency.is_active === true;
      
      const result = await postgresPool.query(
        `INSERT INTO agencies (id, name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          agency.id,
          agency.name,
          agency.email,
          agency.password_hash,
          agency.role || "agency",
          isActive,
          agency.created_at,
          agency.updated_at || agency.created_at,
        ]
      );
      
      idMap[agency.id] = agency.id; // Conserver le même ID
      console.log(`   ✅ Agency migrée: ${agency.name} (ID: ${agency.id})`);
    } catch (error) {
      console.error(`   ❌ Erreur migration agency ${agency.id}: ${error.message}`);
    }
  }
  
  console.log(`   ✅ ${agencies.length} agencies migrées\n`);
  return idMap;
}

async function migrateGroups(agencyIdMap) {
  console.log("📦 Migration des groups...");
  
  const groups = sqliteDb.prepare("SELECT * FROM groups").all();
  console.log(`   Trouvé ${groups.length} groups`);
  
  if (groups.length === 0) {
    console.log("   ⚠️  Aucun group à migrer\n");
    return {};
  }
  
  const idMap = {};
  
  for (const group of groups) {
    try {
      // Vérifier que l'agency existe dans PostgreSQL
      if (!agencyIdMap[group.agency_id]) {
        console.log(`   ⚠️  Group ${group.id} ignoré: agency_id ${group.agency_id} n'existe pas`);
        continue;
      }
      
      const isActive = group.is_active === 1 || group.is_active === true;
      
      const result = await postgresPool.query(
        `INSERT INTO groups (id, agency_id, whatsapp_group_id, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           agency_id = EXCLUDED.agency_id,
           whatsapp_group_id = EXCLUDED.whatsapp_group_id,
           name = EXCLUDED.name,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          group.id,
          group.agency_id,
          group.whatsapp_group_id,
          group.name,
          isActive,
          group.created_at,
          group.updated_at || group.created_at,
        ]
      );
      
      idMap[group.id] = group.id;
      console.log(`   ✅ Group migré: ${group.name} (ID: ${group.id})`);
    } catch (error) {
      console.error(`   ❌ Erreur migration group ${group.id}: ${error.message}`);
    }
  }
  
  console.log(`   ✅ ${groups.length} groups migrés\n`);
  return idMap;
}

async function migrateDeliveries(agencyIdMap, groupIdMap) {
  console.log("📦 Migration des deliveries...");
  
  const deliveries = sqliteDb.prepare("SELECT * FROM deliveries").all();
  console.log(`   Trouvé ${deliveries.length} deliveries`);
  
  if (deliveries.length === 0) {
    console.log("   ⚠️  Aucune delivery à migrer\n");
    return {};
  }
  
  const idMap = {};
  let successCount = 0;
  let errorCount = 0;
  
  for (const delivery of deliveries) {
    try {
      // Vérifier les foreign keys
      if (delivery.agency_id && !agencyIdMap[delivery.agency_id]) {
        console.log(`   ⚠️  Delivery ${delivery.id} ignorée: agency_id ${delivery.agency_id} n'existe pas`);
        errorCount++;
        continue;
      }
      if (delivery.group_id && !groupIdMap[delivery.group_id]) {
        console.log(`   ⚠️  Delivery ${delivery.id} ignorée: group_id ${delivery.group_id} n'existe pas`);
        errorCount++;
        continue;
      }
      
      // Convertir REAL -> DECIMAL
      const amountDue = delivery.amount_due ? parseFloat(delivery.amount_due) : 0;
      const amountPaid = delivery.amount_paid ? parseFloat(delivery.amount_paid) : 0;
      
      const result = await postgresPool.query(
        `INSERT INTO deliveries (
          id, phone, customer_name, items, amount_due, amount_paid, status,
          quartier, notes, carrier, group_id, agency_id, whatsapp_message_id,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          phone = EXCLUDED.phone,
          customer_name = EXCLUDED.customer_name,
          items = EXCLUDED.items,
          amount_due = EXCLUDED.amount_due,
          amount_paid = EXCLUDED.amount_paid,
          status = EXCLUDED.status,
          quartier = EXCLUDED.quartier,
          notes = EXCLUDED.notes,
          carrier = EXCLUDED.carrier,
          group_id = EXCLUDED.group_id,
          agency_id = EXCLUDED.agency_id,
          whatsapp_message_id = EXCLUDED.whatsapp_message_id,
          updated_at = EXCLUDED.updated_at`,
        [
          delivery.id,
          delivery.phone,
          delivery.customer_name,
          delivery.items,
          amountDue,
          amountPaid,
          delivery.status || "pending",
          delivery.quartier,
          delivery.notes,
          delivery.carrier,
          delivery.group_id || null,
          delivery.agency_id || null,
          delivery.whatsapp_message_id || null,
          delivery.created_at,
          delivery.updated_at || delivery.created_at,
        ]
      );
      
      idMap[delivery.id] = delivery.id;
      successCount++;
      
      if (successCount % 100 === 0) {
        console.log(`   ⏳ ${successCount} deliveries migrées...`);
      }
    } catch (error) {
      console.error(`   ❌ Erreur migration delivery ${delivery.id}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`   ✅ ${successCount} deliveries migrées`);
  if (errorCount > 0) {
    console.log(`   ⚠️  ${errorCount} deliveries ignorées (erreurs)\n`);
  } else {
    console.log();
  }
  return idMap;
}

async function migrateDeliveryHistory(deliveryIdMap, agencyIdMap) {
  console.log("📦 Migration du delivery_history...");
  
  const history = sqliteDb.prepare("SELECT * FROM delivery_history ORDER BY id").all();
  console.log(`   Trouvé ${history.length} entrées d'historique`);
  
  if (history.length === 0) {
    console.log("   ⚠️  Aucun historique à migrer\n");
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const entry of history) {
    try {
      // Vérifier que la delivery existe
      if (!deliveryIdMap[entry.delivery_id]) {
        console.log(`   ⚠️  History ${entry.id} ignoré: delivery_id ${entry.delivery_id} n'existe pas`);
        errorCount++;
        continue;
      }
      
      // Vérifier agency_id si présent
      if (entry.agency_id && !agencyIdMap[entry.agency_id]) {
        console.log(`   ⚠️  History ${entry.id} ignoré: agency_id ${entry.agency_id} n'existe pas`);
        errorCount++;
        continue;
      }
      
      await postgresPool.query(
        `INSERT INTO delivery_history (id, delivery_id, action, details, actor, agency_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           delivery_id = EXCLUDED.delivery_id,
           action = EXCLUDED.action,
           details = EXCLUDED.details,
           actor = EXCLUDED.actor,
           agency_id = EXCLUDED.agency_id`,
        [
          entry.id,
          entry.delivery_id,
          entry.action,
          entry.details,
          entry.actor || "bot",
          entry.agency_id || null,
          entry.created_at,
        ]
      );
      
      successCount++;
      
      if (successCount % 100 === 0) {
        console.log(`   ⏳ ${successCount} entrées migrées...`);
      }
    } catch (error) {
      console.error(`   ❌ Erreur migration history ${entry.id}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`   ✅ ${successCount} entrées d'historique migrées`);
  if (errorCount > 0) {
    console.log(`   ⚠️  ${errorCount} entrées ignorées (erreurs)\n`);
  } else {
    console.log();
  }
}

async function resetSequences() {
  console.log("🔄 Réinitialisation des séquences PostgreSQL...\n");
  
  try {
    // Réinitialiser les séquences pour que les prochains IDs soient corrects
    await postgresPool.query(`
      SELECT setval('agencies_id_seq', (SELECT MAX(id) FROM agencies));
      SELECT setval('groups_id_seq', (SELECT MAX(id) FROM groups));
      SELECT setval('deliveries_id_seq', (SELECT MAX(id) FROM deliveries));
      SELECT setval('delivery_history_id_seq', (SELECT MAX(id) FROM delivery_history));
    `);
    console.log("✅ Séquences réinitialisées\n");
  } catch (error) {
    console.error(`⚠️  Erreur réinitialisation séquences: ${error.message}\n`);
  }
}

async function main() {
  console.log("🚀 Migration SQLite → PostgreSQL\n");
  console.log(`📂 SQLite: ${SQLITE_DB_PATH}`);
  console.log(`📂 PostgreSQL: ${POSTGRES_URL.replace(/:[^:@]+@/, ':****@')}\n`);
  
  try {
    await initConnections();
    
    // Migration dans l'ordre des dépendances
    const agencyIdMap = await migrateAgencies();
    const groupIdMap = await migrateGroups(agencyIdMap);
    const deliveryIdMap = await migrateDeliveries(agencyIdMap, groupIdMap);
    await migrateDeliveryHistory(deliveryIdMap, agencyIdMap);
    
    await resetSequences();
    
    console.log("✅ Migration terminée avec succès!\n");
    
    // Statistiques finales
    const stats = await postgresPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM agencies) as agencies,
        (SELECT COUNT(*) FROM groups) as groups,
        (SELECT COUNT(*) FROM deliveries) as deliveries,
        (SELECT COUNT(*) FROM delivery_history) as history
    `);
    
    console.log("📊 Statistiques PostgreSQL:");
    console.log(`   Agencies: ${stats.rows[0].agencies}`);
    console.log(`   Groups: ${stats.rows[0].groups}`);
    console.log(`   Deliveries: ${stats.rows[0].deliveries}`);
    console.log(`   History: ${stats.rows[0].history}\n`);
    
  } catch (error) {
    console.error("\n❌ Erreur lors de la migration:", error);
    process.exit(1);
  } finally {
    if (sqliteDb) sqliteDb.close();
    if (postgresPool) await postgresPool.end();
  }
}

main();


