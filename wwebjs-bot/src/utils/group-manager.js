/**
 * Group Manager Utility
 * Handles automatic group registration and retrieval
 */

const { adapter, createGroup } = require("../db");

/**
 * Get or create a group in the database
 * @param {string} whatsappGroupId - WhatsApp group ID (from chat.id._serialized)
 * @param {string} groupName - Group name from WhatsApp
 * @param {number|null} agencyId - Agency ID to assign the group to (null = use default)
 * @returns {Promise<Object>} - Group object from database
 */
async function getOrCreateGroup(whatsappGroupId, groupName, agencyId = null) {
  try {
    // First, try to find existing group by WhatsApp ID
    const findGroupQuery =
      adapter.type === "postgres"
        ? `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active 
         FROM groups g 
         WHERE g.whatsapp_group_id = $1 LIMIT 1`
        : `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active 
         FROM groups g 
         WHERE g.whatsapp_group_id = ? LIMIT 1`;

    const existingGroups = await adapter.query(findGroupQuery, [
      whatsappGroupId,
    ]);
    const existingGroup =
      adapter.type === "postgres"
        ? Array.isArray(existingGroups) && existingGroups.length > 0
          ? existingGroups[0]
          : null
        : existingGroups;

    if (existingGroup) {
      console.log(
        `   ✅ Group already exists in database: ${existingGroup.name} (ID: ${existingGroup.id})`
      );
      return existingGroup;
    }

    // Group doesn't exist - need to create it
    console.log(`   📝 Registering new group: ${groupName}`);

    // If no agency_id provided, get default agency
    let finalAgencyId = agencyId;
    if (!finalAgencyId) {
      finalAgencyId = await getDefaultAgencyId();
      if (!finalAgencyId) {
        console.error(
          `   ❌ No agency found in database. Cannot create group "${groupName}"`
        );
        console.error(`   💡 Solutions:`);
        console.error(`      1. Create an agency via the API or frontend`);
        console.error(
          `      2. Run: npm run seed:admin (to create super admin)`
        );
        console.error(`      3. Set DEFAULT_AGENCY_ID in .env file`);
        throw new Error(
          "No agency found. Please create an agency first or set DEFAULT_AGENCY_ID in config."
        );
      }
      console.log(
        `   🔗 Assigning group to default agency (ID: ${finalAgencyId})`
      );
    }

    // Create the group
    const groupId = await createGroup({
      agency_id: finalAgencyId,
      whatsapp_group_id: whatsappGroupId,
      name: groupName || "Unnamed Group",
      is_active: true,
    });

    // Get the created group
    const getGroupQuery =
      adapter.type === "postgres"
        ? `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active 
         FROM groups g 
         WHERE g.id = $1 LIMIT 1`
        : `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active 
         FROM groups g 
         WHERE g.id = ? LIMIT 1`;

    const newGroups = await adapter.query(getGroupQuery, [groupId]);
    const newGroup =
      adapter.type === "postgres"
        ? Array.isArray(newGroups) && newGroups.length > 0
          ? newGroups[0]
          : null
        : newGroups;

    if (!newGroup) {
      throw new Error(`Failed to retrieve created group with ID: ${groupId}`);
    }

    console.log(
      `   ✅ Group registered successfully: ${newGroup.name} (ID: ${newGroup.id})`
    );
    return newGroup;
  } catch (error) {
    console.error(`   ❌ Error registering group: ${error.message}`);
    throw error;
  }
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

    // Get all active agencies (excluding super_admin)
    const getAgenciesQuery =
      adapter.type === "postgres"
        ? `SELECT id, name, role FROM agencies WHERE is_active = true AND role != 'super_admin' ORDER BY id ASC`
        : `SELECT id, name, role FROM agencies WHERE is_active = 1 AND role != 'super_admin' ORDER BY id ASC`;

    const agencies = await adapter.query(getAgenciesQuery);
    const activeAgencies =
      adapter.type === "postgres"
        ? Array.isArray(agencies)
          ? agencies
          : []
        : (Array.isArray(agencies) ? agencies : [agencies]).filter(Boolean);

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
    const getAgencyQuery =
      adapter.type === "postgres"
        ? `SELECT id FROM agencies WHERE is_active = true ORDER BY id ASC LIMIT 1`
        : `SELECT id FROM agencies WHERE is_active = 1 ORDER BY id ASC LIMIT 1`;

    const fallbackAgencies = await adapter.query(getAgencyQuery);
    const fallbackAgency =
      adapter.type === "postgres"
        ? Array.isArray(fallbackAgencies) && fallbackAgencies.length > 0
          ? fallbackAgencies[0]
          : null
        : fallbackAgencies;

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
    const getGroupQuery =
      adapter.type === "postgres"
        ? `SELECT agency_id FROM groups WHERE id = $1 LIMIT 1`
        : `SELECT agency_id FROM groups WHERE id = ? LIMIT 1`;

    const groups = await adapter.query(getGroupQuery, [groupId]);
    const group =
      adapter.type === "postgres"
        ? Array.isArray(groups) && groups.length > 0
          ? groups[0]
          : null
        : groups;

    return group ? group.agency_id : null;
  } catch (error) {
    console.error(`   ⚠️  Error getting agency for group: ${error.message}`);
    return null;
  }
}

module.exports = {
  getOrCreateGroup,
  getDefaultAgencyId,
  getAgencyIdForGroup,
};
