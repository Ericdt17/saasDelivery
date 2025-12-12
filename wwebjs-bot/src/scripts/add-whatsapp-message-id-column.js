/**
 * Migration script to add whatsapp_message_id column to deliveries table
 * Works with both SQLite and PostgreSQL
 */

const { adapter, query } = require("../db");

async function addWhatsAppMessageIdColumn() {
  try {
    console.log("🔄 Adding whatsapp_message_id column to deliveries table...\n");
    console.log(`📊 Database type: ${adapter.type}\n`);

    if (adapter.type === "sqlite") {
      // Check if column exists
      const tableInfo = await adapter.query("PRAGMA table_info(deliveries)");
      const columns = Array.isArray(tableInfo) ? tableInfo : [tableInfo];
      const hasColumn = columns.some(col => col.name === "whatsapp_message_id");

      if (hasColumn) {
        console.log("✅ Column whatsapp_message_id already exists in SQLite");
        return;
      }

      // Add column
      await adapter.query("ALTER TABLE deliveries ADD COLUMN whatsapp_message_id TEXT");
      console.log("✅ Column whatsapp_message_id added to SQLite database");
    } else {
      // PostgreSQL - use IF NOT EXISTS
      try {
        await adapter.query(`
          ALTER TABLE deliveries 
          ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255)
        `);
        console.log("✅ Column whatsapp_message_id added to PostgreSQL database (or already exists)");
      } catch (err) {
        // Check if column already exists
        const checkQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'deliveries' AND column_name = 'whatsapp_message_id'
        `;
        const result = await adapter.query(checkQuery);
        if (result && result.length > 0) {
          console.log("✅ Column whatsapp_message_id already exists in PostgreSQL");
        } else {
          throw err;
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  addWhatsAppMessageIdColumn()
    .then(() => {
      console.log("\n✅ Script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { addWhatsAppMessageIdColumn };


