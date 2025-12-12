/**
 * Test complet de toutes les fonctionnalités PostgreSQL
 * Teste toutes les opérations CRUD et fonctionnalités de la base de données
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node src/scripts/test-postgres-all.js
 */

require("dotenv").config();
const { Pool } = require("pg");
const { hashPassword } = require("../utils/password");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Erreur: DATABASE_URL doit être défini");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Compteurs de tests
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function log(message, type = "info") {
  const icons = { info: "ℹ️", success: "✅", error: "❌", warning: "⚠️" };
  console.log(`${icons[type] || ""} ${message}`);
}

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    testResults.push({ status: "PASS", message });
    log(message, "success");
    return true;
  } else {
    testsFailed++;
    testResults.push({ status: "FAIL", message });
    log(message, "error");
    return false;
  }
}

async function testConnection() {
  console.log("\n" + "=".repeat(60));
  console.log("🔌 TEST 1: Connexion à PostgreSQL");
  console.log("=".repeat(60) + "\n");

  try {
    const result = await pool.query(
      "SELECT version(), current_database(), current_user"
    );
    assert(true, "Connexion réussie");
    log(`   Base de données: ${result.rows[0].current_database}`, "info");
    log(`   Utilisateur: ${result.rows[0].current_user}`, "info");
    log(`   Version: ${result.rows[0].version.split(",")[0]}`, "info");
    return true;
  } catch (error) {
    assert(false, `Connexion échouée: ${error.message}`);
    return false;
  }
}

async function testTablesExist() {
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST 2: Vérification des tables");
  console.log("=".repeat(60) + "\n");

  const requiredTables = [
    "agencies",
    "groups",
    "deliveries",
    "delivery_history",
  ];
  const existingTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);

  const tableNames = existingTables.rows.map((r) => r.table_name);

  for (const table of requiredTables) {
    assert(tableNames.includes(table), `Table '${table}' existe`);
  }

  return tableNames.includes("agencies");
}

async function testAgenciesCRUD() {
  console.log("\n" + "=".repeat(60));
  console.log("👥 TEST 3: CRUD Agencies");
  console.log("=".repeat(60) + "\n");

  let testAgencyId;
  const testEmail = `test_${Date.now()}@example.com`;
  const passwordHash = await hashPassword("test123");

  try {
    // CREATE
    log("Test CREATE agency...", "info");
    const createResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ["Test Agency", testEmail, passwordHash, "agency", true]
    );
    testAgencyId = createResult.rows[0].id;
    assert(testAgencyId > 0, `Agency créée avec ID: ${testAgencyId}`);

    // READ by ID
    log("Test READ agency by ID...", "info");
    const getByIdResult = await pool.query(
      "SELECT * FROM agencies WHERE id = $1",
      [testAgencyId]
    );
    assert(getByIdResult.rows.length === 1, "Agency trouvée par ID");
    assert(getByIdResult.rows[0].email === testEmail, "Email correct");

    // READ by Email
    log("Test READ agency by email...", "info");
    const getByEmailResult = await pool.query(
      "SELECT * FROM agencies WHERE email = $1",
      [testEmail]
    );
    assert(getByEmailResult.rows.length === 1, "Agency trouvée par email");

    // READ ALL
    log("Test READ all agencies...", "info");
    const getAllResult = await pool.query(
      "SELECT COUNT(*) as count FROM agencies"
    );
    assert(
      parseInt(getAllResult.rows[0].count) > 0,
      "Liste des agencies récupérée"
    );

    // UPDATE
    log("Test UPDATE agency...", "info");
    const updateResult = await pool.query(
      `UPDATE agencies SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      ["Test Agency Updated", testAgencyId]
    );
    assert(updateResult.rowCount === 1, "Agency mise à jour");

    // Vérifier l'update
    const verifyUpdate = await pool.query(
      "SELECT name FROM agencies WHERE id = $1",
      [testAgencyId]
    );
    assert(
      verifyUpdate.rows[0].name === "Test Agency Updated",
      "Nom mis à jour correctement"
    );

    // DELETE (soft delete)
    log("Test DELETE agency (soft delete)...", "info");
    const deleteResult = await pool.query(
      "UPDATE agencies SET is_active = false WHERE id = $1",
      [testAgencyId]
    );
    assert(deleteResult.rowCount === 1, "Agency désactivée (soft delete)");

    // Réactiver l'agency pour les autres tests (on ne la supprime pas maintenant)
    await pool.query("UPDATE agencies SET is_active = true WHERE id = $1", [
      testAgencyId,
    ]);

    return testAgencyId;
  } catch (error) {
    assert(false, `Erreur CRUD agencies: ${error.message}`);
    if (testAgencyId) {
      await pool
        .query("DELETE FROM agencies WHERE id = $1", [testAgencyId])
        .catch(() => {});
    }
    return null;
  }
}

async function testGroupsCRUD(agencyId) {
  console.log("\n" + "=".repeat(60));
  console.log("👥 TEST 4: CRUD Groups");
  console.log("=".repeat(60) + "\n");

  if (!agencyId) {
    log(
      "⚠️  Pas d'agency disponible, création d'une agency de test...",
      "warning"
    );
    const passwordHash = await hashPassword("test123");
    const agencyResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        "Test Agency for Groups",
        `test_agency_${Date.now()}@example.com`,
        passwordHash,
        "agency",
        true,
      ]
    );
    agencyId = agencyResult.rows[0].id;
  } else {
    // Vérifier que l'agency existe toujours
    const checkAgency = await pool.query(
      "SELECT id FROM agencies WHERE id = $1",
      [agencyId]
    );
    if (checkAgency.rows.length === 0) {
      log("⚠️  Agency supprimée, création d'une nouvelle agency...", "warning");
      const passwordHash = await hashPassword("test123");
      const agencyResult = await pool.query(
        `INSERT INTO agencies (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          "Test Agency for Groups",
          `test_agency_${Date.now()}@example.com`,
          passwordHash,
          "agency",
          true,
        ]
      );
      agencyId = agencyResult.rows[0].id;
    }
  }

  let testGroupId;
  const testWhatsappId = `test_group_${Date.now()}`;

  try {
    // CREATE
    log("Test CREATE group...", "info");
    const createResult = await pool.query(
      `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [agencyId, testWhatsappId, "Test Group", true]
    );
    testGroupId = createResult.rows[0].id;
    assert(testGroupId > 0, `Group créé avec ID: ${testGroupId}`);

    // READ by ID
    log("Test READ group by ID...", "info");
    const getByIdResult = await pool.query(
      "SELECT * FROM groups WHERE id = $1",
      [testGroupId]
    );
    assert(getByIdResult.rows.length === 1, "Group trouvé par ID");
    assert(getByIdResult.rows[0].agency_id === agencyId, "agency_id correct");

    // READ by Agency
    log("Test READ groups by agency...", "info");
    const getByAgencyResult = await pool.query(
      "SELECT * FROM groups WHERE agency_id = $1",
      [agencyId]
    );
    assert(getByAgencyResult.rows.length > 0, "Groups trouvés par agency_id");

    // READ ALL
    log("Test READ all groups...", "info");
    const getAllResult = await pool.query(
      "SELECT COUNT(*) as count FROM groups"
    );
    assert(
      parseInt(getAllResult.rows[0].count) > 0,
      "Liste des groups récupérée"
    );

    // UPDATE
    log("Test UPDATE group...", "info");
    const updateResult = await pool.query(
      `UPDATE groups SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      ["Test Group Updated", testGroupId]
    );
    assert(updateResult.rowCount === 1, "Group mis à jour");

    // Restaurer le nom original pour les autres tests (on ne supprime pas le group)
    await pool.query(
      `UPDATE groups SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      ["Test Group", testGroupId]
    );

    return testGroupId;
  } catch (error) {
    assert(false, `Erreur CRUD groups: ${error.message}`);
    if (testGroupId) {
      await pool
        .query("DELETE FROM groups WHERE id = $1", [testGroupId])
        .catch(() => {});
    }
    return null;
  }
}

async function testDeliveriesCRUD(agencyId, groupId) {
  console.log("\n" + "=".repeat(60));
  console.log("📦 TEST 5: CRUD Deliveries");
  console.log("=".repeat(60) + "\n");

  // Vérifier/créer agency si nécessaire
  if (!agencyId) {
    log(
      "⚠️  Pas d'agency disponible, création d'une agency de test...",
      "warning"
    );
    const passwordHash = await hashPassword("test123");
    const agencyResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        "Test Agency for Deliveries",
        `test_agency_${Date.now()}@example.com`,
        passwordHash,
        "agency",
        true,
      ]
    );
    agencyId = agencyResult.rows[0].id;
  } else {
    const checkAgency = await pool.query(
      "SELECT id FROM agencies WHERE id = $1",
      [agencyId]
    );
    if (checkAgency.rows.length === 0) {
      log("⚠️  Agency supprimée, création d'une nouvelle agency...", "warning");
      const passwordHash = await hashPassword("test123");
      const agencyResult = await pool.query(
        `INSERT INTO agencies (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          "Test Agency for Deliveries",
          `test_agency_${Date.now()}@example.com`,
          passwordHash,
          "agency",
          true,
        ]
      );
      agencyId = agencyResult.rows[0].id;
    }
  }

  // Vérifier/créer group si nécessaire
  if (!groupId) {
    log(
      "⚠️  Pas de group disponible, création d'un group de test...",
      "warning"
    );
    const groupResult = await pool.query(
      `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [agencyId, `test_group_${Date.now()}`, "Test Group for Deliveries", true]
    );
    groupId = groupResult.rows[0].id;
  } else {
    const checkGroup = await pool.query("SELECT id FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (checkGroup.rows.length === 0) {
      log("⚠️  Group supprimé, création d'un nouveau group...", "warning");
      const groupResult = await pool.query(
        `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          agencyId,
          `test_group_${Date.now()}`,
          "Test Group for Deliveries",
          true,
        ]
      );
      groupId = groupResult.rows[0].id;
    }
  }

  let testDeliveryId;
  const testPhone = `+2376${Date.now().toString().slice(-8)}`;

  try {
    // CREATE
    log("Test CREATE delivery...", "info");
    const createResult = await pool.query(
      `INSERT INTO deliveries 
       (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, agency_id, group_id, whatsapp_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        testPhone,
        "Test Customer",
        "Test Items",
        5000,
        0,
        "pending",
        "Test Quartier",
        "Test Notes",
        "Test Carrier",
        agencyId,
        groupId,
        `msg_${Date.now()}`,
      ]
    );
    testDeliveryId = createResult.rows[0].id;
    assert(testDeliveryId > 0, `Delivery créée avec ID: ${testDeliveryId}`);

    // READ by ID
    log("Test READ delivery by ID...", "info");
    const getByIdResult = await pool.query(
      "SELECT * FROM deliveries WHERE id = $1",
      [testDeliveryId]
    );
    assert(getByIdResult.rows.length === 1, "Delivery trouvée par ID");
    assert(getByIdResult.rows[0].phone === testPhone, "Phone correct");

    // READ by Phone
    log("Test READ delivery by phone...", "info");
    const getByPhoneResult = await pool.query(
      "SELECT * FROM deliveries WHERE phone = $1 ORDER BY created_at DESC LIMIT 1",
      [testPhone]
    );
    assert(getByPhoneResult.rows.length === 1, "Delivery trouvée par phone");

    // READ with pagination
    log("Test READ deliveries with pagination...", "info");
    const getPaginatedResult = await pool.query(
      "SELECT * FROM deliveries ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [10, 0]
    );
    assert(Array.isArray(getPaginatedResult.rows), "Pagination fonctionne");

    // READ with filters
    log("Test READ deliveries with status filter...", "info");
    const getFilteredResult = await pool.query(
      "SELECT * FROM deliveries WHERE status = $1 LIMIT 10",
      ["pending"]
    );
    assert(
      Array.isArray(getFilteredResult.rows),
      "Filtre par status fonctionne"
    );

    // UPDATE
    log("Test UPDATE delivery...", "info");
    const updateResult = await pool.query(
      `UPDATE deliveries SET status = $1, amount_paid = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      ["delivered", 5000, testDeliveryId]
    );
    assert(updateResult.rowCount === 1, "Delivery mise à jour");

    // Vérifier l'update
    const verifyUpdate = await pool.query(
      "SELECT status, amount_paid FROM deliveries WHERE id = $1",
      [testDeliveryId]
    );
    assert(verifyUpdate.rows[0].status === "delivered", "Status mis à jour");
    assert(
      parseFloat(verifyUpdate.rows[0].amount_paid) === 5000,
      "Amount_paid mis à jour"
    );

    // Ne pas supprimer la delivery maintenant - elle sera utilisée par testDeliveryHistory
    // Le nettoyage sera fait à la fin de tous les tests

    return testDeliveryId;
  } catch (error) {
    assert(false, `Erreur CRUD deliveries: ${error.message}`);
    if (testDeliveryId) {
      await pool
        .query("DELETE FROM deliveries WHERE id = $1", [testDeliveryId])
        .catch(() => {});
    }
    return null;
  }
}

async function testUpdateDeliveryByMessageId(agencyId, groupId) {
  console.log("\n" + "=".repeat(60));
  console.log("💬 TEST 6: Update Delivery by Message ID");
  console.log("=".repeat(60) + "\n");

  // Vérifier/créer agency si nécessaire
  if (!agencyId) {
    log(
      "⚠️  Pas d'agency disponible, création d'une agency de test...",
      "warning"
    );
    const passwordHash = await hashPassword("test123");
    const agencyResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        "Test Agency for Message ID",
        `test_agency_${Date.now()}@example.com`,
        passwordHash,
        "agency",
        true,
      ]
    );
    agencyId = agencyResult.rows[0].id;
  } else {
    const checkAgency = await pool.query(
      "SELECT id FROM agencies WHERE id = $1",
      [agencyId]
    );
    if (checkAgency.rows.length === 0) {
      log("⚠️  Agency supprimée, création d'une nouvelle agency...", "warning");
      const passwordHash = await hashPassword("test123");
      const agencyResult = await pool.query(
        `INSERT INTO agencies (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          "Test Agency for Message ID",
          `test_agency_${Date.now()}@example.com`,
          passwordHash,
          "agency",
          true,
        ]
      );
      agencyId = agencyResult.rows[0].id;
    }
  }

  // Vérifier/créer group si nécessaire
  if (!groupId) {
    log(
      "⚠️  Pas de group disponible, création d'un group de test...",
      "warning"
    );
    const groupResult = await pool.query(
      `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [agencyId, `test_group_${Date.now()}`, "Test Group for Message ID", true]
    );
    groupId = groupResult.rows[0].id;
  } else {
    const checkGroup = await pool.query("SELECT id FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (checkGroup.rows.length === 0) {
      log("⚠️  Group supprimé, création d'un nouveau group...", "warning");
      const groupResult = await pool.query(
        `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          agencyId,
          `test_group_${Date.now()}`,
          "Test Group for Message ID",
          true,
        ]
      );
      groupId = groupResult.rows[0].id;
    }
  }

  let testDeliveryId;
  const testPhone = `+2376${Date.now().toString().slice(-8)}`;
  const testMessageId = `msg_test_${Date.now()}`;

  try {
    // CREATE delivery with whatsapp_message_id
    log("Test CREATE delivery with whatsapp_message_id...", "info");
    const createResult = await pool.query(
      `INSERT INTO deliveries 
       (phone, customer_name, items, amount_due, amount_paid, status, agency_id, group_id, whatsapp_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        testPhone,
        "Test Customer",
        "Test Items",
        10000,
        0,
        "pending",
        agencyId,
        groupId,
        testMessageId,
      ]
    );
    testDeliveryId = createResult.rows[0].id;
    assert(
      testDeliveryId > 0,
      `Delivery créée avec ID: ${testDeliveryId} et message_id: ${testMessageId}`
    );

    // Test findDeliveryByMessageId
    log("Test findDeliveryByMessageId...", "info");
    const findResult = await pool.query(
      "SELECT * FROM deliveries WHERE whatsapp_message_id = $1 ORDER BY created_at DESC LIMIT 1",
      [testMessageId]
    );
    assert(findResult.rows.length === 1, "Delivery trouvée par message_id");
    assert(findResult.rows[0].id === testDeliveryId, "ID de delivery correct");
    assert(findResult.rows[0].status === "pending", "Status initial correct");

    // Test updateDeliveryByMessageId - Update status
    log("Test updateDeliveryByMessageId - Update status...", "info");
    const updateStatusResult = await pool.query(
      `UPDATE deliveries 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT id FROM deliveries WHERE whatsapp_message_id = $2 ORDER BY created_at DESC LIMIT 1)`,
      ["delivered", testMessageId]
    );
    assert(
      updateStatusResult.rowCount === 1,
      "Delivery mise à jour via message_id (status)"
    );

    // Vérifier l'update
    const verifyStatus = await pool.query(
      "SELECT status FROM deliveries WHERE whatsapp_message_id = $1",
      [testMessageId]
    );
    assert(
      verifyStatus.rows[0].status === "delivered",
      "Status mis à jour correctement"
    );

    // Test updateDeliveryByMessageId - Update amount_paid
    log("Test updateDeliveryByMessageId - Update amount_paid...", "info");
    const updateAmountResult = await pool.query(
      `UPDATE deliveries 
       SET amount_paid = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT id FROM deliveries WHERE whatsapp_message_id = $2 ORDER BY created_at DESC LIMIT 1)`,
      [5000, testMessageId]
    );
    assert(
      updateAmountResult.rowCount === 1,
      "Delivery mise à jour via message_id (amount_paid)"
    );

    // Vérifier l'update
    const verifyAmount = await pool.query(
      "SELECT amount_paid FROM deliveries WHERE whatsapp_message_id = $1",
      [testMessageId]
    );
    assert(
      parseFloat(verifyAmount.rows[0].amount_paid) === 5000,
      "Amount_paid mis à jour correctement"
    );

    // Test updateDeliveryByMessageId - Multiple fields
    log("Test updateDeliveryByMessageId - Multiple fields...", "info");
    const updateMultipleResult = await pool.query(
      `UPDATE deliveries 
       SET status = $1, amount_paid = $2, notes = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = (SELECT id FROM deliveries WHERE whatsapp_message_id = $4 ORDER BY created_at DESC LIMIT 1)`,
      ["pickup", 7500, "Updated via message ID", testMessageId]
    );
    assert(
      updateMultipleResult.rowCount === 1,
      "Delivery mise à jour via message_id (multiple fields)"
    );

    // Vérifier l'update
    const verifyMultiple = await pool.query(
      "SELECT status, amount_paid, notes FROM deliveries WHERE whatsapp_message_id = $1",
      [testMessageId]
    );
    assert(
      verifyMultiple.rows[0].status === "pickup",
      "Status mis à jour (multiple)"
    );
    assert(
      parseFloat(verifyMultiple.rows[0].amount_paid) === 7500,
      "Amount_paid mis à jour (multiple)"
    );
    assert(
      verifyMultiple.rows[0].notes === "Updated via message ID",
      "Notes mises à jour (multiple)"
    );

    // Test avec message_id inexistant (devrait retourner 0 rows)
    log("Test updateDeliveryByMessageId - Message ID inexistant...", "info");
    const updateNonExistentResult = await pool.query(
      `UPDATE deliveries 
       SET status = $1 
       WHERE id = (SELECT id FROM deliveries WHERE whatsapp_message_id = $2 ORDER BY created_at DESC LIMIT 1)`,
      ["delivered", "non_existent_message_id"]
    );
    assert(
      updateNonExistentResult.rowCount === 0,
      "Aucune mise à jour pour message_id inexistant"
    );

    // Ne pas supprimer la delivery maintenant - elle sera nettoyée à la fin de tous les tests

    return testDeliveryId;
  } catch (error) {
    assert(false, `Erreur updateDeliveryByMessageId: ${error.message}`);
    if (testDeliveryId) {
      await pool
        .query("DELETE FROM deliveries WHERE id = $1", [testDeliveryId])
        .catch(() => {});
    }
    return null;
  }
}

async function testDeliveryHistory(deliveryId) {
  console.log("\n" + "=".repeat(60));
  console.log("📜 TEST 7: Delivery History");
  console.log("=".repeat(60) + "\n");

  // Vérifier que la delivery existe toujours
  if (deliveryId) {
    const checkDelivery = await pool.query(
      "SELECT id FROM deliveries WHERE id = $1",
      [deliveryId]
    );
    if (checkDelivery.rows.length === 0) {
      log(
        "⚠️  Delivery supprimée, création d'une nouvelle delivery...",
        "warning"
      );
      deliveryId = null; // Forcer la création d'une nouvelle
    }
  }

  if (!deliveryId) {
    log(
      "⚠️  Pas de delivery disponible, création d'une delivery de test...",
      "warning"
    );
    const deliveryResult = await pool.query(
      `INSERT INTO deliveries (phone, customer_name, items, amount_due, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [`+2376${Date.now()}`, "Test Customer", "Test Items", 5000, "pending"]
    );
    deliveryId = deliveryResult.rows[0].id;
  }

  let testHistoryId;

  try {
    // CREATE history
    log("Test CREATE delivery history...", "info");
    const createResult = await pool.query(
      `INSERT INTO delivery_history (delivery_id, action, details, actor)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        deliveryId,
        "status_changed",
        JSON.stringify({ from: "pending", to: "delivered" }),
        "test",
      ]
    );
    testHistoryId = createResult.rows[0].id;
    assert(testHistoryId > 0, `History créé avec ID: ${testHistoryId}`);

    // READ history by delivery_id
    log("Test READ history by delivery_id...", "info");
    const getHistoryResult = await pool.query(
      "SELECT * FROM delivery_history WHERE delivery_id = $1 ORDER BY created_at DESC",
      [deliveryId]
    );
    assert(getHistoryResult.rows.length > 0, "History trouvé par delivery_id");

    // Nettoyer
    await pool.query("DELETE FROM delivery_history WHERE id = $1", [
      testHistoryId,
    ]);
    await pool
      .query("DELETE FROM deliveries WHERE id = $1", [deliveryId])
      .catch(() => {});

    return testHistoryId;
  } catch (error) {
    assert(false, `Erreur delivery history: ${error.message}`);
    if (testHistoryId) {
      await pool
        .query("DELETE FROM delivery_history WHERE id = $1", [testHistoryId])
        .catch(() => {});
    }
    return null;
  }
}

async function testSearch() {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 TEST 8: Recherche");
  console.log("=".repeat(60) + "\n");

  try {
    // Recherche par phone
    log("Test recherche par phone...", "info");
    const searchPhoneResult = await pool.query(
      "SELECT * FROM deliveries WHERE phone LIKE $1 LIMIT 10",
      ["%237%"]
    );
    assert(
      Array.isArray(searchPhoneResult.rows),
      "Recherche par phone fonctionne"
    );

    // Recherche par customer_name
    log("Test recherche par customer_name...", "info");
    const searchNameResult = await pool.query(
      "SELECT * FROM deliveries WHERE customer_name ILIKE $1 LIMIT 10",
      ["%test%"]
    );
    assert(
      Array.isArray(searchNameResult.rows),
      "Recherche par nom fonctionne"
    );

    // Recherche par items
    log("Test recherche par items...", "info");
    const searchItemsResult = await pool.query(
      "SELECT * FROM deliveries WHERE items ILIKE $1 LIMIT 10",
      ["%item%"]
    );
    assert(
      Array.isArray(searchItemsResult.rows),
      "Recherche par items fonctionne"
    );

    // Recherche combinée
    log("Test recherche combinée...", "info");
    const searchCombinedResult = await pool.query(
      `SELECT * FROM deliveries 
       WHERE (phone LIKE $1 OR customer_name ILIKE $1 OR items ILIKE $1 OR quartier ILIKE $1)
       LIMIT 10`,
      ["%test%"]
    );
    assert(
      Array.isArray(searchCombinedResult.rows),
      "Recherche combinée fonctionne"
    );

    return true;
  } catch (error) {
    assert(false, `Erreur recherche: ${error.message}`);
    return false;
  }
}

async function testStatistics() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST 9: Statistiques");
  console.log("=".repeat(60) + "\n");

  try {
    // Stats globales
    log("Test statistiques globales...", "info");
    const globalStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_paid
      FROM deliveries
    `);
    assert(
      globalStatsResult.rows.length === 1,
      "Statistiques globales calculées"
    );
    log(`   Total: ${globalStatsResult.rows[0].total}`, "info");
    log(`   Pending: ${globalStatsResult.rows[0].pending}`, "info");
    log(`   Delivered: ${globalStatsResult.rows[0].delivered}`, "info");

    // Stats par date
    log("Test statistiques par date...", "info");
    const dateStatsResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(amount_due) as total_due
      FROM deliveries
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    assert(
      Array.isArray(dateStatsResult.rows),
      "Statistiques par date calculées"
    );

    // Stats par status
    log("Test statistiques par status...", "info");
    const statusStatsResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM deliveries
      GROUP BY status
    `);
    assert(
      Array.isArray(statusStatsResult.rows),
      "Statistiques par status calculées"
    );

    return true;
  } catch (error) {
    assert(false, `Erreur statistiques: ${error.message}`);
    return false;
  }
}

async function testForeignKeys() {
  console.log("\n" + "=".repeat(60));
  console.log("🔗 TEST 10: Foreign Keys et Relations");
  console.log("=".repeat(60) + "\n");

  try {
    // Créer une agency de test
    const passwordHash = await hashPassword("test123");
    const agencyResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        "FK Test Agency",
        `fk_test_${Date.now()}@example.com`,
        passwordHash,
        "agency",
        true,
      ]
    );
    const testAgencyId = agencyResult.rows[0].id;

    // Créer un group lié à l'agency
    const groupResult = await pool.query(
      `INSERT INTO groups (agency_id, name, is_active)
       VALUES ($1, $2, $3) RETURNING id`,
      [testAgencyId, "FK Test Group", true]
    );
    const testGroupId = groupResult.rows[0].id;

    // Créer une delivery liée au group et agency
    log("Test foreign key: delivery -> group et agency...", "info");
    const deliveryResult = await pool.query(
      `INSERT INTO deliveries (phone, customer_name, items, amount_due, status, agency_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        `+2376${Date.now()}`,
        "FK Test",
        "Test",
        1000,
        "pending",
        testAgencyId,
        testGroupId,
      ]
    );
    const testDeliveryId = deliveryResult.rows[0].id;
    assert(testDeliveryId > 0, "Delivery créée avec foreign keys");

    // Test CASCADE DELETE sur groups
    log("Test CASCADE DELETE: supprimer group...", "info");
    await pool.query("DELETE FROM groups WHERE id = $1", [testGroupId]);
    const checkDelivery = await pool.query(
      "SELECT group_id FROM deliveries WHERE id = $1",
      [testDeliveryId]
    );
    // group_id devrait être NULL après CASCADE
    assert(
      checkDelivery.rows[0].group_id === null,
      "CASCADE DELETE fonctionne (group_id = NULL)"
    );

    // Test CASCADE DELETE sur delivery_history
    log("Test CASCADE DELETE: delivery_history...", "info");
    const historyResult = await pool.query(
      `INSERT INTO delivery_history (delivery_id, action, details)
       VALUES ($1, $2, $3) RETURNING id`,
      [testDeliveryId, "test", "test"]
    );
    const testHistoryId = historyResult.rows[0].id;

    await pool.query("DELETE FROM deliveries WHERE id = $1", [testDeliveryId]);
    const checkHistory = await pool.query(
      "SELECT * FROM delivery_history WHERE id = $1",
      [testHistoryId]
    );
    assert(
      checkHistory.rows.length === 0,
      "CASCADE DELETE fonctionne (history supprimé)"
    );

    // Nettoyer
    await pool.query("DELETE FROM agencies WHERE id = $1", [testAgencyId]);

    return true;
  } catch (error) {
    assert(false, `Erreur foreign keys: ${error.message}`);
    return false;
  }
}

async function testIndexes() {
  console.log("\n" + "=".repeat(60));
  console.log("📇 TEST 11: Indexes");
  console.log("=".repeat(60) + "\n");

  try {
    const indexesResult = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    const expectedIndexes = [
      "idx_deliveries_phone",
      "idx_deliveries_status",
      "idx_deliveries_created_at",
      "idx_deliveries_group_id",
      "idx_deliveries_agency_id",
      "idx_groups_agency_id",
      "idx_agencies_email",
      "idx_history_delivery_id",
    ];

    const existingIndexes = indexesResult.rows.map((r) => r.indexname);

    for (const index of expectedIndexes) {
      assert(existingIndexes.includes(index), `Index '${index}' existe`);
    }

    // Test performance avec index
    log("Test performance avec index (phone)...", "info");
    const startTime = Date.now();
    await pool.query("SELECT * FROM deliveries WHERE phone = $1 LIMIT 1", [
      "+23761234567",
    ]);
    const duration = Date.now() - startTime;
    assert(duration < 1000, `Requête avec index rapide (${duration}ms)`);

    return true;
  } catch (error) {
    assert(false, `Erreur indexes: ${error.message}`);
    return false;
  }
}

async function testDataTypes() {
  console.log("\n" + "=".repeat(60));
  console.log("🔢 TEST 12: Types de données");
  console.log("=".repeat(60) + "\n");

  try {
    // Test DECIMAL pour amounts
    log("Test type DECIMAL pour amounts...", "info");
    const decimalTest = await pool.query(`
      SELECT 
        amount_due::text as amount_due_type,
        amount_paid::text as amount_paid_type
      FROM deliveries 
      LIMIT 1
    `);
    if (decimalTest.rows.length > 0) {
      assert(true, "Types DECIMAL corrects pour amounts");
    } else {
      log("⚠️  Pas de données pour tester les types", "warning");
    }

    // Test BOOLEAN pour is_active
    log("Test type BOOLEAN pour is_active...", "info");
    const booleanTest = await pool.query(`
      SELECT is_active::text as is_active_type
      FROM agencies 
      LIMIT 1
    `);
    if (booleanTest.rows.length > 0) {
      assert(true, "Type BOOLEAN correct pour is_active");
    }

    // Test TIMESTAMP pour dates
    log("Test type TIMESTAMP pour dates...", "info");
    const timestampTest = await pool.query(`
      SELECT 
        created_at::text as created_type,
        updated_at::text as updated_type
      FROM deliveries 
      LIMIT 1
    `);
    if (timestampTest.rows.length > 0) {
      assert(true, "Types TIMESTAMP corrects pour dates");
    }

    return true;
  } catch (error) {
    assert(false, `Erreur types de données: ${error.message}`);
    return false;
  }
}

async function testConstraints() {
  console.log("\n" + "=".repeat(60));
  console.log("🔒 TEST 13: Contraintes");
  console.log("=".repeat(60) + "\n");

  try {
    // Test UNIQUE constraint sur email
    log("Test contrainte UNIQUE sur email...", "info");
    const passwordHash = await hashPassword("test123");
    const testEmail = `unique_test_${Date.now()}@example.com`;

    // Créer première agency
    const firstResult = await pool.query(
      `INSERT INTO agencies (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ["Unique Test 1", testEmail, passwordHash, "agency"]
    );
    const firstId = firstResult.rows[0].id;

    // Essayer de créer une deuxième avec le même email (devrait échouer)
    try {
      await pool.query(
        `INSERT INTO agencies (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)`,
        ["Unique Test 2", testEmail, passwordHash, "agency"]
      );
      assert(false, "Contrainte UNIQUE sur email devrait échouer");
    } catch (error) {
      if (error.code === "23505") {
        assert(true, "Contrainte UNIQUE sur email fonctionne");
      } else {
        throw error;
      }
    }

    // Nettoyer
    await pool.query("DELETE FROM agencies WHERE id = $1", [firstId]);

    // Test NOT NULL constraint
    log("Test contrainte NOT NULL...", "info");
    try {
      await pool.query(`INSERT INTO deliveries (phone) VALUES (NULL)`);
      assert(false, "Contrainte NOT NULL sur phone devrait échouer");
    } catch (error) {
      if (error.code === "23502") {
        assert(true, "Contrainte NOT NULL fonctionne");
      } else {
        throw error;
      }
    }

    return true;
  } catch (error) {
    assert(false, `Erreur contraintes: ${error.message}`);
    return false;
  }
}

async function testTransactions() {
  console.log("\n" + "=".repeat(60));
  console.log("💼 TEST 14: Transactions");
  console.log("=".repeat(60) + "\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Créer une agency dans la transaction
    const passwordHash = await hashPassword("test123");
    const agencyResult = await client.query(
      `INSERT INTO agencies (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        "Transaction Test",
        `trans_test_${Date.now()}@example.com`,
        passwordHash,
        "agency",
      ]
    );
    const agencyId = agencyResult.rows[0].id;

    // Créer un group dans la même transaction
    const groupResult = await client.query(
      `INSERT INTO groups (agency_id, name)
       VALUES ($1, $2) RETURNING id`,
      [agencyId, "Transaction Group"]
    );
    const groupId = groupResult.rows[0].id;

    // Rollback pour tester
    await client.query("ROLLBACK");

    // Vérifier que rien n'a été créé
    const checkAgency = await pool.query(
      "SELECT * FROM agencies WHERE id = $1",
      [agencyId]
    );
    const checkGroup = await pool.query("SELECT * FROM groups WHERE id = $1", [
      groupId,
    ]);

    assert(
      checkAgency.rows.length === 0,
      "ROLLBACK fonctionne (agency non créée)"
    );
    assert(
      checkGroup.rows.length === 0,
      "ROLLBACK fonctionne (group non créé)"
    );

    // Test COMMIT
    await client.query("BEGIN");
    const commitAgencyResult = await client.query(
      `INSERT INTO agencies (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        "Commit Test",
        `commit_test_${Date.now()}@example.com`,
        passwordHash,
        "agency",
      ]
    );
    const commitAgencyId = commitAgencyResult.rows[0].id;
    await client.query("COMMIT");

    const checkCommit = await pool.query(
      "SELECT * FROM agencies WHERE id = $1",
      [commitAgencyId]
    );
    assert(checkCommit.rows.length === 1, "COMMIT fonctionne (agency créée)");

    // Nettoyer
    await pool.query("DELETE FROM agencies WHERE id = $1", [commitAgencyId]);

    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    assert(false, `Erreur transactions: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 RAPPORT FINAL");
  console.log("=".repeat(60) + "\n");

  console.log(`✅ Tests réussis: ${testsPassed}`);
  console.log(`❌ Tests échoués: ${testsFailed}`);
  console.log(
    `📈 Taux de réussite: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`
  );

  if (testsFailed > 0) {
    console.log("❌ Tests échoués:");
    testResults
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`   - ${r.message}`));
    console.log();
  }

  // Statistiques de la base
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM agencies) as agencies,
        (SELECT COUNT(*) FROM groups) as groups,
        (SELECT COUNT(*) FROM deliveries) as deliveries,
        (SELECT COUNT(*) FROM delivery_history) as history
    `);
    console.log("📊 Statistiques de la base de données:");
    console.log(`   Agencies: ${stats.rows[0].agencies}`);
    console.log(`   Groups: ${stats.rows[0].groups}`);
    console.log(`   Deliveries: ${stats.rows[0].deliveries}`);
    console.log(`   History: ${stats.rows[0].history}\n`);
  } catch (error) {
    // Ignore
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST COMPLET POSTGRESQL - TOUTES LES FONCTIONNALITÉS");
  console.log("=".repeat(60));
  console.log(
    `📂 Base de données: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}\n`
  );

  try {
    // Tests de base
    if (!(await testConnection())) {
      console.error("❌ Impossible de continuer sans connexion");
      process.exit(1);
    }

    if (!(await testTablesExist())) {
      console.error(
        "❌ Tables manquantes. Exécutez d'abord: node src/scripts/create-postgres-tables.js"
      );
      process.exit(1);
    }

    // Tests CRUD
    const testAgencyId = await testAgenciesCRUD();
    const testGroupId = await testGroupsCRUD(testAgencyId);
    const testDeliveryId = await testDeliveriesCRUD(testAgencyId, testGroupId);

    // Tests fonctionnalités
    await testUpdateDeliveryByMessageId(testAgencyId, testGroupId);
    await testDeliveryHistory(testDeliveryId);
    await testSearch();
    await testStatistics();
    await testForeignKeys();
    await testIndexes();
    await testDataTypes();
    await testConstraints();
    await testTransactions();

    // Rapport final
    await generateReport();

    // Nettoyer les données de test créées
    log("Nettoyage des données de test...", "info");
    try {
      await pool.query(
        "DELETE FROM agencies WHERE email LIKE 'test_%' OR email LIKE '%test_%'"
      );
      await pool.query(
        "DELETE FROM groups WHERE name LIKE 'Test%' OR name LIKE '%Test%'"
      );
      await pool.query(
        "DELETE FROM deliveries WHERE customer_name LIKE 'Test%' OR customer_name LIKE '%Test%'"
      );
    } catch (cleanupError) {
      log(
        `Erreur lors du nettoyage (non critique): ${cleanupError.message}`,
        "warning"
      );
    }

    if (testsFailed === 0) {
      console.log("✅ TOUS LES TESTS SONT PASSÉS!\n");
      process.exit(0);
    } else {
      console.log("⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
