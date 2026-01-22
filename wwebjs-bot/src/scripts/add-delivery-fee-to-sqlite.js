/**
 * Script pour ajouter le champ delivery_fee aux bases SQLite existantes
 * Ce script vérifie si le champ existe et l'ajoute s'il n'existe pas
 */

const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const DB_PATH = config.DB_PATH || path.join(__dirname, '..', '..', 'data', 'deliveries.db');

function addDeliveryFeeColumn() {
  console.log('🔧 Ajout du champ delivery_fee à la table deliveries...\n');
  console.log(`📍 Base de données: ${DB_PATH}\n`);

  if (!require('fs').existsSync(DB_PATH)) {
    console.log('❌ La base de données n\'existe pas. Le champ sera ajouté automatiquement lors de la création de la table.');
    return;
  }

  const db = new Database(DB_PATH);
  
  try {
    // Vérifier si la colonne existe déjà
    const tableInfo = db.prepare("PRAGMA table_info(deliveries)").all();
    const hasDeliveryFee = tableInfo.some(col => col.name === 'delivery_fee');
    
    if (hasDeliveryFee) {
      console.log('✅ Le champ delivery_fee existe déjà dans la table deliveries.');
      db.close();
      return;
    }

    // Ajouter la colonne
    console.log('📝 Ajout de la colonne delivery_fee...');
    db.exec('ALTER TABLE deliveries ADD COLUMN delivery_fee REAL DEFAULT 0');
    console.log('✅ Colonne delivery_fee ajoutée avec succès!');
    
    db.close();
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de la colonne:', error.message);
    db.close();
    process.exit(1);
  }
}

addDeliveryFeeColumn();
