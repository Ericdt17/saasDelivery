/**
 * Script to reassign a group and its deliveries to a different agency
 * Usage: node src/scripts/reassign-group-to-agency.js <group_id> <target_agency_id>
 */

const { adapter, query } = require("../db");

async function reassignGroupToAgency(groupId, targetAgencyId) {
  try {
    console.log("🔄 Reassigning group and deliveries to agency...\n");

    // Verify group exists
    const getGroupQuery = adapter.type === "postgres"
      ? `SELECT id, agency_id, name FROM groups WHERE id = $1 LIMIT 1`
      : `SELECT id, agency_id, name FROM groups WHERE id = ? LIMIT 1`;

    const groups = await adapter.query(getGroupQuery, [groupId]);
    const group = adapter.type === "postgres" ? groups[0] : groups;

    if (!group) {
      console.error(`❌ Group with ID ${groupId} not found`);
      process.exit(1);
    }

    console.log(`📋 Group found: ${group.name} (ID: ${group.id})`);
    console.log(`   Current agency: ${group.agency_id}`);
    console.log(`   Target agency: ${targetAgencyId}\n`);

    // Verify target agency exists
    const getAgencyQuery = adapter.type === "postgres"
      ? `SELECT id, name, email FROM agencies WHERE id = $1 LIMIT 1`
      : `SELECT id, name, email FROM agencies WHERE id = ? LIMIT 1`;

    const agencies = await adapter.query(getAgencyQuery, [targetAgencyId]);
    const agency = adapter.type === "postgres" ? agencies[0] : agencies;

    if (!agency) {
      console.error(`❌ Agency with ID ${targetAgencyId} not found`);
      process.exit(1);
    }

    console.log(`✅ Target agency found: ${agency.name} (${agency.email})\n`);

    // Update group
    console.log("📝 Updating group...");
    const updateGroupQuery = adapter.type === "postgres"
      ? `UPDATE groups SET agency_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
      : `UPDATE groups SET agency_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    const groupResult = await adapter.query(updateGroupQuery, [targetAgencyId, groupId]);
    const groupUpdated = adapter.type === "postgres"
      ? groupResult?.rowCount || 0
      : groupResult?.changes || 0;

    console.log(`   ✅ Group updated (${groupUpdated} row(s))\n`);

    // Update deliveries
    console.log("📦 Updating deliveries...");
    const updateDeliveriesQuery = adapter.type === "postgres"
      ? `UPDATE deliveries SET agency_id = $1, updated_at = CURRENT_TIMESTAMP WHERE group_id = $2`
      : `UPDATE deliveries SET agency_id = ?, updated_at = CURRENT_TIMESTAMP WHERE group_id = ?`;

    const deliveriesResult = await adapter.query(updateDeliveriesQuery, [targetAgencyId, groupId]);
    const deliveriesUpdated = adapter.type === "postgres"
      ? deliveriesResult?.rowCount || 0
      : deliveriesResult?.changes || 0;

    console.log(`   ✅ ${deliveriesUpdated} delivery/deliveries updated\n`);

    // Update delivery history
    console.log("📜 Updating delivery history...");
    const updateHistoryQuery = adapter.type === "postgres"
      ? `UPDATE delivery_history SET agency_id = $1 WHERE delivery_id IN (SELECT id FROM deliveries WHERE group_id = $2)`
      : `UPDATE delivery_history SET agency_id = ? WHERE delivery_id IN (SELECT id FROM deliveries WHERE group_id = ?)`;

    const historyResult = await adapter.query(updateHistoryQuery, [targetAgencyId, groupId]);
    const historyUpdated = adapter.type === "postgres"
      ? historyResult?.rowCount || 0
      : historyResult?.changes || 0;

    console.log(`   ✅ ${historyUpdated} history record(s) updated\n`);

    console.log("✅ Reassignment completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Group ID: ${groupId}`);
    console.log(`   - New Agency ID: ${targetAgencyId}`);
    console.log(`   - Deliveries updated: ${deliveriesUpdated}`);
    console.log(`   - History records updated: ${historyUpdated}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error("❌ Usage: node reassign-group-to-agency.js <group_id> <target_agency_id>");
  console.error("\nExample:");
  console.error("   node reassign-group-to-agency.js 7 24");
  process.exit(1);
}

const groupId = parseInt(args[0]);
const targetAgencyId = parseInt(args[1]);

if (isNaN(groupId) || isNaN(targetAgencyId)) {
  console.error("❌ Group ID and Agency ID must be numbers");
  process.exit(1);
}

// Run reassignment
reassignGroupToAgency(groupId, targetAgencyId)
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

