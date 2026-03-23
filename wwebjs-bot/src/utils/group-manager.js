/**
 * Group Manager Utility
 * Handles automatic group registration and retrieval
 * Now includes agency code verification for new groups
 */

const { adapter, createGroup, findAgencyByCode } = require("../db");
const { isPendingVerification } = require("./group-verification");

/**
 * Get a group from the database by WhatsApp group ID
 * Only returns existing groups - no auto-creation or auto-linking
 * @param {string} whatsappGroupId - WhatsApp group ID (from chat.id._serialized)
 * @returns {Promise<Object|null>} - Group object from database, or null if not found
 */
async function getGroup(whatsappGroupId) {
  try {
    // First, check if group exists (even if inactive) for debugging
    const allGroup = await adapter.query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active FROM groups g WHERE g.whatsapp_group_id = $1 LIMIT 1`,
      [whatsappGroupId]
    );
    
    if (allGroup) {
      console.log(`   📊 Group found in database (checking active status):`);
      console.log(`      - Name: ${allGroup.name}`);
      console.log(`      - DB ID: ${allGroup.id}`);
      console.log(`      - is_active: ${allGroup.is_active}`);
      console.log(`      - WhatsApp ID in DB: ${allGroup.whatsapp_group_id}`);
      
      // Check if IDs match exactly (with detailed comparison)
      if (allGroup.whatsapp_group_id !== whatsappGroupId) {
        console.log(`   ⚠️  ID MISMATCH DETECTED:`);
        console.log(`      - Looking for: "${whatsappGroupId}"`);
        console.log(`      - Found in DB:  "${allGroup.whatsapp_group_id}"`);
        console.log(`      - Length diff: ${whatsappGroupId.length} vs ${allGroup.whatsapp_group_id.length}`);
      }
    }
    
    // Find existing group by WhatsApp ID (only active groups)
    const existingGroup = await adapter.query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active FROM groups g WHERE g.whatsapp_group_id = $1 AND g.is_active = true LIMIT 1`,
      [whatsappGroupId]
    );

    if (existingGroup) {
      console.log(
        `   ✅ Group found in database: ${existingGroup.name} (DB ID: ${existingGroup.id}, Agency: ${existingGroup.agency_id})`
      );
      return existingGroup;
    }

    // Group not found or inactive
    if (allGroup && !allGroup.is_active) {
      console.log(`   ⚠️  Group exists but is INACTIVE (is_active = false)`);
      console.log(`   💡 Solution: Activate the group in the dashboard (set is_active = true)`);
    } else {
      console.log(`   ⏭️  Group not found in database: ${whatsappGroupId}`);
      console.log(`   💡 Solution: Add this group via the dashboard`);
    }
    return null;
  } catch (error) {
    console.error(`   ❌ Error checking group: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * @deprecated Use getGroup() instead. This function is kept for backward compatibility.
 * Get or create a group in the database (legacy function - now only checks for existing groups)
 */
async function getOrCreateGroup(whatsappGroupId, groupName, agencyId = null, messageText = null) {
  // Simply delegate to getGroup() - no auto-creation
  return await getGroup(whatsappGroupId);
}

/**
 * Get default agency ID (first active agency, or from config)
 * If only one active agency (non-super-admin) exists, use it automatically
 * @returns {Promise<number|null>} - Agency ID or null
 */
async function getDefaultAgencyId() {
  try {
    // Check if DEFAULT_AGENCY_ID is set in config
    const config = require("../config");
    if (config.DEFAULT_AGENCY_ID) {
      return parseInt(config.DEFAULT_AGENCY_ID);
    }

    const activeAgencies = await adapter.query(
      `SELECT id, name, role FROM agencies WHERE is_active = true AND role != 'super_admin' ORDER BY id ASC`
    ) || [];

    // If only one active agency (non-super-admin) exists, use it automatically
    if (activeAgencies.length === 1) {
      console.log(
        `   🔍 Auto-detected single active agency: ${activeAgencies[0].name} (ID: ${activeAgencies[0].id})`
      );
      return activeAgencies[0].id;
    }

    // If multiple agencies, get the first one (or you can set DEFAULT_AGENCY_ID in config)
    if (activeAgencies.length > 0) {
      console.log(
        `   ⚠️  Multiple active agencies found (${activeAgencies.length}). Using first one: ${activeAgencies[0].name} (ID: ${activeAgencies[0].id})`
      );
      console.log(
        `   💡 Tip: Set DEFAULT_AGENCY_ID in .env to specify which agency to use`
      );
      return activeAgencies[0].id;
    }

    // Fallback: Get first active agency (including super_admin)
    const fallbackAgency = await adapter.query(
      `SELECT id FROM agencies WHERE is_active = true ORDER BY id ASC LIMIT 1`
    );
    return fallbackAgency ? fallbackAgency.id : null;
  } catch (error) {
    console.error(`   ⚠️  Error getting default agency: ${error.message}`);
    return null;
  }
}

/**
 * Get agency ID for a group
 * @param {number} groupId - Group database ID
 * @returns {Promise<number|null>} - Agency ID or null
 */
async function getAgencyIdForGroup(groupId) {
  try {
    const group = await adapter.query(
      `SELECT agency_id FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    return group ? group.agency_id : null;
  } catch (error) {
    console.error(`   ⚠️  Error getting agency for group: ${error.message}`);
    return null;
  }
}

/**
 * Verify agency code and link group to agency
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @param {string} code - Agency code to verify
 * @param {string} groupName - Group name
 * @returns {Promise<Object|null>} - Group object if verified and created, null if code invalid
 */
async function verifyAgencyCodeAndLinkGroup(whatsappGroupId, code, groupName) {
  try {
    // Normalize code (trim, uppercase for case-insensitive matching)
    const normalizedCode = (code || "").trim().toUpperCase();
    
    if (!normalizedCode || normalizedCode.length < 4) {
      console.log(`   ❌ Invalid code format: code must be at least 4 characters`);
      return null;
    }

    // Find agency by code using the database function
    const agency = await findAgencyByCode(normalizedCode);

    if (!agency) {
      console.log(`   ❌ No agency found with code: ${normalizedCode}`);
      return null;
    }

    // Agency found - create group linked to this agency
    console.log(`   ✅ Agency code verified: ${agency.name} (ID: ${agency.id})`);
    console.log(`   📝 Creating group linked to agency...`);

    const groupId = await createGroup({
      agency_id: agency.id,
      whatsapp_group_id: whatsappGroupId,
      name: groupName || "Unnamed Group",
      is_active: true,
    });

    // Get the created group
    const newGroup = await adapter.query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active FROM groups g WHERE g.id = $1 LIMIT 1`,
      [groupId]
    );

    if (!newGroup) {
      throw new Error(`Failed to retrieve created group with ID: ${groupId}`);
    }

    console.log(
      `   ✅ Group registered successfully: ${newGroup.name} (ID: ${newGroup.id}, Agency: ${agency.name})`
    );
    return newGroup;
  } catch (error) {
    console.error(`   ❌ Error verifying code and creating group: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getGroup,
  getOrCreateGroup, // Kept for backward compatibility
  getDefaultAgencyId,
  getAgencyIdForGroup,
  verifyAgencyCodeAndLinkGroup, // Kept for backward compatibility (may be used elsewhere)
};
