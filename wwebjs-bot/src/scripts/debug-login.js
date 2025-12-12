/**
 * Debug Login Script
 * Helps diagnose login issues by checking database and password verification
 * 
 * Usage:
 *   node src/scripts/debug-login.js admin@livrexpress.com admin123
 */

require("dotenv").config();
const db = require("../db");
const { comparePassword, hashPassword } = require("../utils/password");

async function debugLogin(email, password) {
  try {
    console.log("🔍 Debugging login for:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Database type: ${db.adapter.type}\n`);

    // Normalize email like the seed script does
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`📧 Normalized email: ${normalizedEmail}\n`);

    // Check if user exists
    console.log("1️⃣ Checking if user exists...");
    let agency;
    try {
      agency = await db.getAgencyByEmail(normalizedEmail);
    } catch (err) {
      // Try with original email too
      agency = await db.getAgencyByEmail(email);
    }

    if (!agency) {
      console.log("❌ User NOT found in database!");
      console.log("\n💡 Try creating the user first:");
      console.log(`   node src/scripts/seed-super-admin.js --email ${normalizedEmail} --password ${password}`);
      await db.close();
      process.exit(1);
    }

    console.log("✅ User found!");
    console.log(`   ID: ${agency.id}`);
    console.log(`   Name: ${agency.name}`);
    console.log(`   Email (stored): ${agency.email}`);
    console.log(`   Role: ${agency.role}`);
    console.log(`   Active: ${agency.is_active}`);
    console.log(`   Password hash: ${agency.password_hash ? agency.password_hash.substring(0, 20) + '...' : 'MISSING'}\n`);

    // Check if account is active
    const isActive = db.adapter.type === "postgres" 
      ? agency.is_active 
      : agency.is_active === 1;

    if (!isActive) {
      console.log("❌ Account is INACTIVE!");
      console.log("💡 Update is_active to true in database\n");
      await db.close();
      process.exit(1);
    }

    // Check password
    console.log("2️⃣ Verifying password...");
    if (!agency.password_hash) {
      console.log("❌ Password hash is MISSING!");
      console.log("💡 Reset the password:");
      console.log(`   node src/scripts/reset-password.js ${normalizedEmail} ${password}\n`);
      await db.close();
      process.exit(1);
    }

    const isPasswordValid = await comparePassword(password, agency.password_hash);
    
    if (!isPasswordValid) {
      console.log("❌ Password does NOT match!");
      console.log("\n💡 Reset the password:");
      console.log(`   node src/scripts/reset-password.js ${normalizedEmail} ${password}\n`);
      
      // Show what the hash should be
      console.log("🔐 Testing password hash generation...");
      const testHash = await hashPassword(password);
      console.log(`   New hash would be: ${testHash.substring(0, 30)}...`);
      
      await db.close();
      process.exit(1);
    }

    console.log("✅ Password is VALID!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ All checks passed! Login should work.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during debug:");
    console.error(`   ${error.message}`);
    console.error(error.stack);
    
    try {
      await db.close();
    } catch (closeError) {
      // Ignore
    }
    
    process.exit(1);
  }
}

// Get email and password from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ Usage: node src/scripts/debug-login.js <email> <password>");
  console.error("   Example: node src/scripts/debug-login.js admin@livrexpress.com admin123");
  process.exit(1);
}

const email = args[0];
const password = args[1];

debugLogin(email, password);


