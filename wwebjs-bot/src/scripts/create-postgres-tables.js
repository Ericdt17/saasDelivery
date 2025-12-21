/**
 * Script pour créer les tables PostgreSQL
 * Vérifie et crée toutes les tables nécessaires
 * 
 * Usage:
 * DATABASE_URL=postgresql://... node src/scripts/create-postgres-tables.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Erreur: DATABASE_URL doit être défini");
  console.error("💡 Définissez DATABASE_URL dans .env ou en variable d'environnement");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkConnection() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Connexion PostgreSQL réussie\n");
    return true;
  } catch (error) {
    console.error("❌ Erreur de connexion:", error.message);
    return false;
  }
}

async function checkExistingTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = result.rows.map(row => row.table_name);
    console.log("📋 Tables existantes:", tables.length > 0 ? tables.join(", ") : "Aucune");
    return tables;
  } catch (error) {
    console.error("❌ Erreur lors de la vérification:", error.message);
    return [];
  }
}

async function createTables() {
  console.log("🔨 Création des tables...\n");
  
  try {
    // 1. Créer agencies
    console.log("1️⃣  Création de la table 'agencies'...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agencies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'agency',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✅ Table 'agencies' créée");

    // 2. Créer groups
    console.log("2️⃣  Création de la table 'groups'...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        agency_id INTEGER NOT NULL,
        whatsapp_group_id VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
      )
    `);
    console.log("   ✅ Table 'groups' créée");

    // 3. Créer deliveries
    console.log("3️⃣  Création de la table 'deliveries'...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        customer_name VARCHAR(255),
        items TEXT,
        amount_due DECIMAL(10, 2) DEFAULT 0,
        amount_paid DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        quartier VARCHAR(255),
        notes TEXT,
        carrier VARCHAR(255),
        group_id INTEGER,
        agency_id INTEGER,
        whatsapp_message_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
      )
    `);
    console.log("   ✅ Table 'deliveries' créée");

    // 4. Créer delivery_history
    console.log("4️⃣  Création de la table 'delivery_history'...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_history (
        id SERIAL PRIMARY KEY,
        delivery_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        details TEXT,
        actor VARCHAR(100) DEFAULT 'bot',
        agency_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
      )
    `);
    console.log("   ✅ Table 'delivery_history' créée\n");

    // 5. Créer les index
    console.log("5️⃣  Création des index...");
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id ON deliveries(whatsapp_message_id)",
      "CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id)",
      "CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id)",
      "CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email)",
      "CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id)",
      "CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id)",
    ];

    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
      } catch (err) {
        // Ignore les erreurs d'index (peuvent déjà exister)
      }
    }
    console.log("   ✅ Index créés\n");

    return true;
  } catch (error) {
    console.error("❌ Erreur lors de la création:", error.message);
    console.error("   Détails:", error);
    return false;
  }
}

async function verifyTables() {
  console.log("🔍 Vérification des tables...\n");
  
  const expectedTables = ["agencies", "groups", "deliveries", "delivery_history"];
  const existingTables = await checkExistingTables();
  
  console.log();
  for (const table of expectedTables) {
    if (existingTables.includes(table)) {
      console.log(`✅ ${table} - existe`);
      
      // Compter les lignes
      try {
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   📊 Lignes: ${count.rows[0].count}`);
      } catch (err) {
        console.log(`   ⚠️  Impossible de compter les lignes`);
      }
    } else {
      console.log(`❌ ${table} - MANQUANTE`);
    }
  }
  console.log();
}

async function main() {
  console.log("🚀 Création des tables PostgreSQL\n");
  console.log(`📂 Base de données: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
  
  // Vérifier la connexion
  if (!(await checkConnection())) {
    process.exit(1);
  }
  
  // Vérifier les tables existantes
  const existingTables = await checkExistingTables();
  console.log();
  
  // Créer les tables
  if (await createTables()) {
    console.log("✅ Toutes les tables ont été créées avec succès!\n");
  } else {
    console.error("❌ Erreur lors de la création des tables");
    process.exit(1);
  }
  
  // Vérifier à nouveau
  await verifyTables();
  
  await pool.end();
  console.log("✅ Terminé!");
}

main().catch(error => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});



