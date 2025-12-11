/**
 * Migration Script: Assign Existing Deliveries to Default Agency/Group
 * 
 * This script:
 * 1. Creates a default agency (if none exists)
 * 2. Creates a default group for that agency (if none exists)
 * 3. Assigns all existing deliveries to the default agency/group
 * 
 * Works with both SQLite and PostgreSQL
 */

const { adapter, query } = require("./db");

// Check if bcrypt is installed
let bcrypt;
try {
  bcrypt = require("bcrypt");
} catch (err) {
  console.error("❌ bcrypt is required for this migration script.");
  console.error("   Please install it: npm install bcrypt");
  process.exit(1);
}

async function migrateExistingData() {
  try {
    console.log("🔄 Starting migration of existing data...");
    console.log(`📊 Database type: ${adapter.type}`);

    // Step 1: Check if agencies table exists and has data
    let agenciesExist = false;
    try {
      const agencies = await query("SELECT COUNT(*) as count FROM agencies");
      agenciesExist = agencies && (agencies[0]?.count > 0 || agencies?.count > 0);
    } catch (err) {
      console.log("⚠️  Agencies table doesn't exist yet or is empty");
    }

    // Step 2: Create default agency if none exists
    let defaultAgencyId;
    if (!agenciesExist) {
      console.log("📝 Creating default agency...");
      
      // Generate a default password hash (password: "changeme")
      const defaultPassword = "changeme";
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      const agencyInsert = adapter.type === "postgres"
        ? `INSERT INTO agencies (name, email, password_hash, role, is_active) 
           VALUES ($1, $2, $3, $4, $5) RETURNING id`
        : `INSERT INTO agencies (name, email, password_hash, role, is_active) 
           VALUES (?, ?, ?, ?, ?)`;
      
      const params = [
        "Default Agency",
        "admin@default.com",
        passwordHash,
        "agency",
        adapter.type === "postgres" ? true : 1
      ];

      const result = await query(agencyInsert, params);
      defaultAgencyId = adapter.type === "postgres" 
        ? result[0]?.id || result.id 
        : result.lastInsertRowid;
      
      console.log(`✅ Created default agency with ID: ${defaultAgencyId}`);
      console.log(`   Email: admin@default.com`);
      console.log(`   Password: changeme (PLEASE CHANGE THIS!)`);
    } else {
      // Get first agency as default
      const agencies = await query("SELECT id FROM agencies LIMIT 1");
      defaultAgencyId = adapter.type === "postgres" 
        ? agencies[0]?.id 
        : agencies?.id;
      console.log(`✅ Using existing agency with ID: ${defaultAgencyId}`);
    }

    // Step 3: Create default group for the agency
    let defaultGroupId;
    try {
      const groupsCheck = adapter.type === "postgres"
        ? `SELECT id FROM groups WHERE agency_id = $1 LIMIT 1`
        : `SELECT id FROM groups WHERE agency_id = ? LIMIT 1`;
      
      const existingGroup = await query(groupsCheck, [defaultAgencyId]);
      
      if (existingGroup && (existingGroup[0] || existingGroup)) {
        defaultGroupId = adapter.type === "postgres" 
          ? existingGroup[0]?.id 
          : existingGroup?.id;
        console.log(`✅ Using existing group with ID: ${defaultGroupId}`);
      } else {
        console.log("📝 Creating default group...");
        
        const groupInsert = adapter.type === "postgres"
          ? `INSERT INTO groups (agency_id, name, is_active) 
             VALUES ($1, $2, $3) RETURNING id`
          : `INSERT INTO groups (agency_id, name, is_active) 
             VALUES (?, ?, ?)`;
        
        const groupParams = [
          defaultAgencyId,
          "Default Group",
          adapter.type === "postgres" ? true : 1
        ];
        
        const groupResult = await query(groupInsert, groupParams);
        defaultGroupId = adapter.type === "postgres" 
          ? groupResult[0]?.id || groupResult.id 
          : groupResult.lastInsertRowid;
        
        console.log(`✅ Created default group with ID: ${defaultGroupId}`);
      }
    } catch (err) {
      console.error("❌ Error creating default group:", err.message);
      throw err;
    }

    // Step 4: Update existing deliveries to assign agency_id and group_id
    console.log("📦 Updating existing deliveries...");
    
    const updateDeliveries = adapter.type === "postgres"
      ? `UPDATE deliveries 
         SET agency_id = $1, group_id = $2 
         WHERE agency_id IS NULL OR group_id IS NULL`
      : `UPDATE deliveries 
         SET agency_id = ?, group_id = ? 
         WHERE agency_id IS NULL OR group_id IS NULL`;
    
    const updateResult = await query(updateDeliveries, [defaultAgencyId, defaultGroupId]);
    
    const updatedCount = adapter.type === "postgres" 
      ? updateResult?.rowCount || updateResult?.changes || 0
      : updateResult?.changes || 0;
    
    console.log(`✅ Updated ${updatedCount} deliveries with agency_id and group_id`);

    // Step 5: Update delivery_history to assign agency_id
    console.log("📜 Updating delivery history...");
    
    const updateHistory = adapter.type === "postgres"
      ? `UPDATE delivery_history 
         SET agency_id = $1 
         WHERE agency_id IS NULL`
      : `UPDATE delivery_history 
         SET agency_id = ? 
         WHERE agency_id IS NULL`;
    
    const historyResult = await query(updateHistory, [defaultAgencyId]);
    
    const historyCount = adapter.type === "postgres" 
      ? historyResult?.rowCount || historyResult?.changes || 0
      : historyResult?.changes || 0;
    
    console.log(`✅ Updated ${historyCount} history records with agency_id`);

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Default Agency ID: ${defaultAgencyId}`);
    console.log(`   - Default Group ID: ${defaultGroupId}`);
    console.log(`   - Deliveries updated: ${updatedCount}`);
    console.log(`   - History records updated: ${historyCount}`);
    console.log("\n⚠️  IMPORTANT: Change the default agency password!");
    console.log("   Email: admin@default.com");
    console.log("   Password: changeme");

  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateExistingData()
    .then(() => {
      console.log("\n✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = { migrateExistingData };

