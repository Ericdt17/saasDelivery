/**
 * Test script to verify agency token and API access
 */

const { adapter, getAgencyById, getGroupsByAgency, getDeliveryStats } = require("../db");
const { generateToken } = require("../utils/jwt");

async function testAgencyToken() {
  try {
    console.log("🔍 Testing Agency Token and API Access\n");

    // Get agency 2
    const agency = await getAgencyById(2);
    if (!agency) {
      console.error("❌ Agency 2 not found");
      return;
    }

    console.log("📋 Agency Details:");
    console.log("   ID:", agency.id);
    console.log("   Name:", agency.name);
    console.log("   Email:", agency.email);
    console.log("   Role:", agency.role);
    console.log("   Role === 'agency':", agency.role === "agency");
    console.log("   Is Active:", agency.is_active);

    // Generate token like in login
    const token = generateToken({
      id: agency.id,
      userId: agency.id,
      agencyId: agency.role === "super_admin" ? null : agency.id,
      email: agency.email,
      role: agency.role,
    });

    console.log("\n🔑 Generated Token Payload:");
    const jwt = require("jsonwebtoken");
    const decoded = jwt.decode(token);
    console.log("   userId:", decoded.userId);
    console.log("   agencyId:", decoded.agencyId);
    console.log("   email:", decoded.email);
    console.log("   role:", decoded.role);

    // Test queries
    console.log("\n📊 Testing Queries:");

    const agencyId = decoded.agencyId !== null && decoded.agencyId !== undefined 
      ? decoded.agencyId 
      : decoded.userId;

    console.log("   Using agencyId:", agencyId);

    const groups = await getGroupsByAgency(agencyId);
    console.log("   Groups found:", groups?.length || 0);
    if (groups && groups.length > 0) {
      console.log("   First group:", groups[0]?.name);
    }

    const stats = await getDeliveryStats(null, agencyId, null);
    console.log("   Stats - Total deliveries:", stats?.total || 0);
    console.log("   Stats - Delivered:", stats?.delivered || 0);
    console.log("   Stats - Total collected:", stats?.total_collected || 0);

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  }
}

// Run test
testAgencyToken()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });


