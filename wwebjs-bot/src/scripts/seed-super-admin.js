/**
 * Seed Super Admin Script
 * Creates the initial super admin account if one doesn't exist
 * 
 * Usage:
 *   node src/scripts/seed-super-admin.js
 *   node src/scripts/seed-super-admin.js --email admin@example.com --password mypassword --name "Super Admin"
 * 
 * Environment Variables:
 *   SUPER_ADMIN_EMAIL - Email for super admin (default: admin@livrexpress.com)
 *   SUPER_ADMIN_PASSWORD - Password for super admin (default: admin123)
 *   SUPER_ADMIN_NAME - Name for super admin (default: Super Administrator)
 */

require("dotenv").config();
const db = require("../db");
const { hashPassword } = require("../utils/password");

// Get configuration from environment variables or use defaults
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@livrexpress.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "admin123";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || "Super Administrator";

// Parse command line arguments
const args = process.argv.slice(2);
let email = SUPER_ADMIN_EMAIL;
let password = SUPER_ADMIN_PASSWORD;
let name = SUPER_ADMIN_NAME;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email" && args[i + 1]) {
    email = args[i + 1];
    i++;
  } else if (args[i] === "--password" && args[i + 1]) {
    password = args[i + 1];
    i++;
  } else if (args[i] === "--name" && args[i + 1]) {
    name = args[i + 1];
    i++;
  }
}

async function seedSuperAdmin() {
  try {
    console.log("🔍 Checking for existing super admin...");
    console.log(`📧 Email: ${email}`);
    console.log(`💾 Database type: ${db.adapter.type}\n`);

    // Check if super admin already exists by email
    let existingByEmail;
    try {
      existingByEmail = await db.getAgencyByEmail(email);
    } catch (dbError) {
      if (dbError.message && (dbError.message.includes("does not exist") || dbError.message.includes("relation") || dbError.code === "42P01")) {
        console.error("\n❌ Error: The 'agencies' table does not exist in your database.");
        console.error("   Please run the migration first:");
        console.error("   npm run migrate:postgres\n");
        throw new Error("Database tables not initialized. Run migration first.");
      }
      throw dbError;
    }
    if (existingByEmail) {
      console.log("✅ Super admin already exists!");
      console.log(`   ID: ${existingByEmail.id}`);
      console.log(`   Name: ${existingByEmail.name}`);
      console.log(`   Email: ${existingByEmail.email}`);
      console.log(`   Role: ${existingByEmail.role}`);
      console.log(`   Status: ${existingByEmail.is_active ? "Active" : "Inactive"}`);
      
      if (existingByEmail.role !== "super_admin") {
        console.log("\n⚠️  Warning: Account exists but is not a super admin!");
        console.log("   You may want to update the role manually.");
      }
      
      await db.close();
      process.exit(0);
    }

    // Check if any super admin exists
    const allAgencies = await db.getAllAgencies();
    const existingSuperAdmin = allAgencies.find(
      (agency) => agency.role === "super_admin"
    );

    if (existingSuperAdmin) {
      console.log("✅ A super admin already exists in the database!");
      console.log(`   ID: ${existingSuperAdmin.id}`);
      console.log(`   Name: ${existingSuperAdmin.name}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log("\n💡 If you want to create another super admin, use a different email.");
      await db.close();
      process.exit(0);
    }

    // No super admin exists, create one
    console.log("📝 No super admin found. Creating new super admin account...\n");

    // Validate inputs
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email address");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }
    if (!name || name.trim().length === 0) {
      throw new Error("Name cannot be empty");
    }

    // Hash the password
    console.log("🔐 Hashing password...");
    const passwordHash = await hashPassword(password);

    // Create the super admin
    console.log("👤 Creating super admin account...");
    // SQLite needs 1/0, PostgreSQL needs true/false
    const isActive = db.adapter.type === "sqlite" ? 1 : true;
    const agencyId = await db.createAgency({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: "super_admin",
      is_active: isActive,
    });

    console.log("\n✅ Super admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   ID: ${agencyId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: super_admin`);
    console.log(`   Status: Active`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 You can now log in to the application with these credentials.");
    console.log("⚠️  Please change the default password after first login!\n");

    // Close database connection
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating super admin:");
    console.error(`   ${error.message}`);
    
    if (error.code === "SQLITE_CONSTRAINT" || error.code === "23505") {
      console.error("\n💡 This email is already registered. Use a different email.");
    } else if (error.message.includes("password")) {
      console.error("\n💡 Please provide a password that is at least 6 characters long.");
    } else if (error.message.includes("email")) {
      console.error("\n💡 Please provide a valid email address.");
    }

    try {
      await db.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  seedSuperAdmin();
}

module.exports = { seedSuperAdmin };

