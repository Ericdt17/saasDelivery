/**
 * Create a local vendor account linked to the only local agency/group.
 *
 * Usage:
 *   node src/scripts/create-local-vendor.js
 *   node src/scripts/create-local-vendor.js --email vendor@test.com --password vendor123 --name "Test Vendor"
 *
 * Behavior:
 * - Finds the first active agency with role='agency'
 * - Finds the first active group belonging to that agency
 * - Creates a vendor account in `agencies` with:
 *   role='vendor', parent_agency_id=<agency.id>, group_id=<group.id>
 */

require("dotenv").config();

const db = require("../db");
const { hashPassword } = require("../utils/password");

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    const v = args[i + 1];
    if (k === "--email" && v) {
      out.email = v;
      i++;
    } else if (k === "--password" && v) {
      out.password = v;
      i++;
    } else if (k === "--name" && v) {
      out.name = v;
      i++;
    }
  }
  return out;
}

function randomEmail() {
  const ts = Date.now();
  return `vendor_${ts}@test.local`;
}

async function main() {
  const { email, password, name } = parseArgs(process.argv);

  const finalEmail = (email || randomEmail()).trim().toLowerCase();
  const finalPassword = String(password || "vendor123");
  const finalName = String(name || "Local Vendor").trim();

  if (!finalEmail.includes("@")) {
    throw new Error("Invalid email (use --email someone@example.com)");
  }
  if (finalPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (!finalName) {
    throw new Error("Name cannot be empty");
  }

  // Find the (single) agency in local DB
  const agency = await db.adapter.query(
    `SELECT id, name, email, role, is_active
     FROM agencies
     WHERE role = 'agency' AND is_active = true
     ORDER BY id ASC
     LIMIT 1`
  );
  if (!agency) {
    throw new Error("No active agency found in local DB (role='agency').");
  }

  // Find a group belonging to that agency (required by FK + vendor scoping)
  const group = await db.adapter.query(
    `SELECT id, agency_id, name, is_active
     FROM groups
     WHERE agency_id = $1 AND is_active = true
     ORDER BY id ASC
     LIMIT 1`,
    [agency.id]
  );
  if (!group) {
    throw new Error(
      `No active group found for agency_id=${agency.id}. Create a group first.`
    );
  }

  // Prevent conflicts
  const existing = await db.adapter.query(
    `SELECT id, name, email, role, is_active, group_id, parent_agency_id
     FROM agencies
     WHERE email = $1
     LIMIT 1`,
    [finalEmail]
  );
  if (existing) {
    console.log("⚠️  Account already exists for this email.");
    console.log(`   id: ${existing.id}`);
    console.log(`   role: ${existing.role}`);
    console.log(`   is_active: ${existing.is_active}`);
    console.log(`   parent_agency_id: ${existing.parent_agency_id}`);
    console.log(`   group_id: ${existing.group_id}`);
    console.log("\n💡 Use a different --email, or reset password if needed.");
    await db.close();
    process.exit(0);
  }

  const password_hash = await hashPassword(finalPassword);

  const vendorId = await db.createAgency({
    name: finalName,
    email: finalEmail,
    password_hash,
    role: "vendor",
    is_active: true,
    group_id: group.id,
    parent_agency_id: agency.id,
  });

  const vendor = await db.getAgencyById(vendorId);

  console.log("\n✅ Vendor created successfully");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   vendor_id: ${vendor?.id ?? vendorId}`);
  console.log(`   name: ${vendor?.name ?? finalName}`);
  console.log(`   email: ${finalEmail}`);
  console.log(`   password: ${finalPassword}`);
  console.log(`   role: vendor`);
  console.log(`   parent_agency_id: ${agency.id} (${agency.name})`);
  console.log(`   group_id: ${group.id} (${group.name})`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await db.close();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error("\n❌ Error creating local vendor:");
    console.error(`   ${err.message}`);
    try {
      await db.close();
    } catch {
      // ignore
    }
    process.exit(1);
  });
}

