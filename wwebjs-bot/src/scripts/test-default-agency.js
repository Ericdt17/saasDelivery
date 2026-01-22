/**
 * Test script to verify DEFAULT_AGENCY_ID configuration
 */

require("dotenv").config();
const { getDefaultAgencyId } = require("../utils/group-manager");
const { getAgencyById } = require("../db");

async function testDefaultAgency() {
  try {
    console.log("🔍 Testing DEFAULT_AGENCY_ID configuration...\n");

    // Check environment variable
    console.log("📋 Environment check:");
    console.log("   DEFAULT_AGENCY_ID from .env:", process.env.DEFAULT_AGENCY_ID || "not set");

    // Check config
    const config = require("../config");
    console.log("   DEFAULT_AGENCY_ID from config:", config.DEFAULT_AGENCY_ID || "not set");

    // Test getDefaultAgencyId function
    console.log("\n🔧 Testing getDefaultAgencyId()...");
    const agencyId = await getDefaultAgencyId();

    if (!agencyId) {
      console.error("❌ No agency ID returned!");
      return;
    }

    console.log("   ✅ Default agency ID:", agencyId);

    // Get agency details
    const agency = await getAgencyById(agencyId);
    if (agency) {
      console.log("\n📋 Default Agency Details:");
      console.log("   ID:", agency.id);
      console.log("   Name:", agency.name);
      console.log("   Email:", agency.email);
      console.log("   Role:", agency.role);
      console.log("   Is Active:", agency.is_active);
    } else {
      console.error("❌ Agency not found!");
    }

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

testDefaultAgency()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });













