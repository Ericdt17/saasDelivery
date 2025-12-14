/**
 * Group Verification State Manager
 * Manages in-memory state for groups awaiting agency code verification
 * 
 * When a bot receives a message from an unknown group, it asks for an agency code.
 * This module tracks which groups are waiting for verification and their attempts.
 */

// In-memory storage for pending group verifications
// Key: whatsappGroupId (string)
// Value: { groupName, attempts, timestamp, lastMessage }
const pendingGroups = new Map();

// Configuration
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Add a group to pending verification state
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @param {string} groupName - Group name
 * @returns {Object} - Pending group info
 */
function addPendingGroup(whatsappGroupId, groupName) {
  const pendingInfo = {
    groupName: groupName || "Unnamed Group",
    attempts: 0,
    timestamp: Date.now(),
    lastMessage: null,
  };
  
  pendingGroups.set(whatsappGroupId, pendingInfo);
  console.log(`   🔐 Group added to pending verification: ${pendingInfo.groupName}`);
  console.log(`   💡 Waiting for agency code...`);
  
  return pendingInfo;
}

/**
 * Get pending group info
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @returns {Object|null} - Pending group info or null if not pending
 */
function getPendingGroup(whatsappGroupId) {
  return pendingGroups.get(whatsappGroupId) || null;
}

/**
 * Check if a group is pending verification
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @returns {boolean} - True if group is pending verification
 */
function isPendingVerification(whatsappGroupId) {
  const pending = pendingGroups.get(whatsappGroupId);
  if (!pending) {
    return false;
  }
  
  // Check if expired
  const age = Date.now() - pending.timestamp;
  if (age > TIMEOUT_MS) {
    console.log(`   ⏰ Pending verification expired for group: ${pending.groupName}`);
    pendingGroups.delete(whatsappGroupId);
    return false;
  }
  
  return true;
}

/**
 * Increment verification attempts for a group
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @returns {Object|null} - Updated pending group info or null if max attempts reached
 */
function incrementAttempts(whatsappGroupId) {
  const pending = pendingGroups.get(whatsappGroupId);
  if (!pending) {
    return null;
  }
  
  pending.attempts += 1;
  pending.lastMessage = Date.now();
  
  if (pending.attempts >= MAX_ATTEMPTS) {
    console.log(`   ❌ Max verification attempts (${MAX_ATTEMPTS}) reached for group: ${pending.groupName}`);
    pendingGroups.delete(whatsappGroupId);
    return null;
  }
  
  return pending;
}

/**
 * Remove a group from pending verification state
 * @param {string} whatsappGroupId - WhatsApp group ID
 * @returns {boolean} - True if group was removed, false if not found
 */
function removePendingGroup(whatsappGroupId) {
  const pending = pendingGroups.get(whatsappGroupId);
  if (pending) {
    pendingGroups.delete(whatsappGroupId);
    console.log(`   ✅ Group removed from pending verification: ${pending.groupName}`);
    return true;
  }
  return false;
}

/**
 * Cleanup expired pending groups
 * Removes groups that have been pending for more than TIMEOUT_MS
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredGroups() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [whatsappGroupId, pending] of pendingGroups.entries()) {
    const age = now - pending.timestamp;
    if (age > TIMEOUT_MS) {
      pendingGroups.delete(whatsappGroupId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`   🧹 Cleaned up ${cleaned} expired pending verification(s)`);
  }
  
  return cleaned;
}

/**
 * Get all pending groups (for debugging/admin purposes)
 * @returns {Array} - Array of pending group info
 */
function getAllPendingGroups() {
  return Array.from(pendingGroups.entries()).map(([whatsappGroupId, info]) => ({
    whatsappGroupId,
    ...info,
    age: Date.now() - info.timestamp,
  }));
}

/**
 * Get statistics about pending verifications
 * @returns {Object} - Stats object
 */
function getStats() {
  cleanupExpiredGroups(); // Clean up before counting
  return {
    total: pendingGroups.size,
    pending: Array.from(pendingGroups.values()).map(p => ({
      groupName: p.groupName,
      attempts: p.attempts,
      age: Date.now() - p.timestamp,
    })),
  };
}

// Setup periodic cleanup (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredGroups();
  }, 10 * 60 * 1000); // Every 10 minutes
}

module.exports = {
  addPendingGroup,
  getPendingGroup,
  removePendingGroup,
  isPendingVerification,
  incrementAttempts,
  cleanupExpiredGroups,
  getAllPendingGroups,
  getStats,
  MAX_ATTEMPTS,
  TIMEOUT_MS,
};

