/**
 * Check active agencies in the database
 */

const { getAllAgencies } = require("../db");

async function checkActiveAgencies() {
  try {
    const agencies = await getAllAgencies();
    const activeAgencies = agencies.filter(a => a.is_active === 1 || a.is_active === true);
    
    console.log(`📊 Total agencies: ${agencies.length}`);
    console.log(`✅ Active agencies: ${activeAgencies.length}\n`);
    
    if (activeAgencies.length === 0) {
      console.log("⚠️  No active agencies found!");
      return null;
    }
    
    console.log("Active agencies:");
    activeAgencies.forEach(a => {
      console.log(`  - ID: ${a.id}, Name: ${a.name}, Email: ${a.email}, Role: ${a.role}`);
    });
    
    if (activeAgencies.length === 1) {
      console.log(`\n✅ Single active agency found: ID ${activeAgencies[0].id} (${activeAgencies[0].name})`);
      console.log(`\n💡 You can set DEFAULT_AGENCY_ID=${activeAgencies[0].id} in your .env file`);
      return activeAgencies[0].id;
    }
    
    return null;
  } catch (error) {
    console.error("❌ Error:", error.message);
    return null;
  }
}

checkActiveAgencies()
  .then((agencyId) => {
    if (agencyId) {
      console.log(`\n✅ Recommended DEFAULT_AGENCY_ID: ${agencyId}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });













