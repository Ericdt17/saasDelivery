/**
 * Reset Password Script
 * Resets the password for an existing user
 * 
 * Usage:
 *   node src/scripts/reset-password.js admin@livrexpress.com admin123
 *   node src/scripts/reset-password.js admin@livrexpress.com "new password"
 */

require("dotenv").config();
const db = require("../db");
const { hashPassword } = require("../utils/password");

async function resetPassword(email, newPassword) {
  try {
    console.log(`🔐 Resetting password for: ${email}`);
    console.log(`💾 Database type: ${db.adapter.type}\n`);

    // Validate inputs
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email address");
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Check if user exists
    const agency = await db.getAgencyByEmail(email);
    if (!agency) {
      throw new Error(`User with email ${email} not found`);
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${agency.id}`);
    console.log(`   Name: ${agency.name}`);
    console.log(`   Email: ${agency.email}`);
    console.log(`   Role: ${agency.role}\n`);

    // Hash the new password
    console.log("🔐 Hashing new password...");
    const passwordHash = await hashPassword(newPassword);

    // Update the password
    console.log("💾 Updating password in database...");
    await db.updateAgency(agency.id, {
      password_hash: passwordHash,
    });

    console.log("\n✅ Password reset successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   Email: ${email}`);
    console.log(`   New Password: ${newPassword}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 You can now log in with the new password.\n");

    // Close database connection
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error resetting password:");
    console.error(`   ${error.message}`);
    
    if (error.message.includes("not found")) {
      console.error("\n💡 Make sure the email address is correct.");
    } else if (error.message.includes("password")) {
      console.error("\n💡 Password must be at least 6 characters long.");
    }

    try {
      await db.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Get email and password from command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ Usage: node src/scripts/reset-password.js <email> <new-password>");
  console.error("   Example: node src/scripts/reset-password.js admin@livrexpress.com admin123");
  process.exit(1);
}

const email = args[0];
const newPassword = args[1];

// Run the script
resetPassword(email, newPassword);

module.exports = { resetPassword };


