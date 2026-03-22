/**
 * Suite de tests complète pour vérifier les calculs automatiques de tarifs
 * Teste tous les scénarios : création, mise à jour, changement de statut, changement de quartier, etc.
 */

const { getDeliveryById, createTariff, updateTariff, getTariffByAgencyAndQuartier } = require('./src/db');
const { hashPassword } = require('./src/utils/password');
const { createAgency } = require('./src/db');

// Configuration de test
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';

// ID de l'agence de test
let testAgencyId = null;

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  parseSetCookie(setCookieHeader) {
    if (!setCookieHeader) return null;
    const parts = String(setCookieHeader).split(';').map(p => p.trim());
    const [nameValue] = parts;
    const [name, value] = nameValue.split('=');

    let maxAge = null;
    for (const part of parts.slice(1)) {
      const lower = part.toLowerCase();
      if (lower.startsWith('max-age=')) {
        maxAge = parseInt(part.split('=')[1], 10);
      }
    }

    return { name, value, maxAge };
  }

  setCookie(setCookieHeader) {
    const cookie = this.parseSetCookie(setCookieHeader);
    if (!cookie || !cookie.name) return;

    // If server clears cookie (Max-Age=0), remove from jar
    if (typeof cookie.maxAge === 'number' && cookie.maxAge === 0) {
      this.cookies.delete(cookie.name);
      return;
    }

    this.cookies.set(cookie.name, cookie);
  }

  getCookieString() {
    const cookieStrings = [];
    for (const [_, cookie] of this.cookies) {
      cookieStrings.push(`${cookie.name}=${cookie.value}`);
    }
    return cookieStrings.join('; ');
  }
}

const cookieJar = new CookieJar();

// Helper pour faire des requêtes HTTP avec authentification
async function makeRequest(endpoint, options = {}, skipAuth = false) {
  const url = `${API_BASE_URL}${API_VERSION}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (!skipAuth) {
    const cookieString = cookieJar.getCookieString();
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    cookieJar.setCookie(setCookieHeader);
  }
  
  const data = await response.json().catch(() => ({}));
  return { response, data, status: response.status };
}

// Helper pour logger
function log(message, color = 'white') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[0m',
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
}

function logTest(name) {
  log(`\n🧪 Test: ${name}`, 'cyan');
}

function logPass(message) {
  log(`  ✅ ${message}`, 'green');
}

function logFail(message, details = null) {
  log(`  ❌ ${message}`, 'red');
  if (details) {
    log(`     Details: ${JSON.stringify(details, null, 2)}`, 'yellow');
  }
}

function assertEqual(actual, expected, message) {
  const actualNum = parseFloat(actual) || 0;
  const expectedNum = parseFloat(expected) || 0;
  const tolerance = 0.01; // Tolérance pour les arrondis
  
  if (Math.abs(actualNum - expectedNum) <= tolerance) {
    logPass(message);
    return true;
  } else {
    logFail(`${message} - Attendu: ${expectedNum}, Reçu: ${actualNum}`);
    return false;
  }
}

// Fonction pour créer un utilisateur de test
async function createTestUser() {
  try {
    const testEmail = 'test-tariff-auto@example.com';
    const testPassword = 'test123456';
    
    const { adapter } = require('./src/db');
    const findQuery = adapter.type === 'postgres'
      ? `SELECT id FROM agencies WHERE email = $1 LIMIT 1`
      : `SELECT id FROM agencies WHERE email = ? LIMIT 1`;
    
    const existing = await adapter.query(findQuery, [testEmail]);
    const existingAgency = Array.isArray(existing) ? existing[0] : existing;
    
    if (existingAgency && (existingAgency.id || existingAgency)) {
      testAgencyId = existingAgency.id || existingAgency;
      return true;
    }
    
    const passwordHash = await hashPassword(testPassword);
    const agency = await createAgency({
      name: 'Test Agency Auto',
      email: testEmail,
      password_hash: passwordHash,
      role: 'agency',
      is_active: true,
    });
    
    testAgencyId = agency.id || agency;
    return true;
  } catch (error) {
    return false;
  }
}

// Fonction pour se connecter
async function login() {
  const testEmail = 'test-tariff-auto@example.com';
  const testPassword = 'test123456';
  
  const loginResponse = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  }, true);
  
  if (loginResponse.status === 200 && loginResponse.data.success) {
    log('  ✅ Login OK (auth cookie set)');

    const user = loginResponse.data.data?.user;
    if (user?.id) {
      testAgencyId = user.id;
    }

    return true;
  } else if (loginResponse.status === 401) {
    const userCreated = await createTestUser();
    if (userCreated) {
      return await login();
    }
  }
  
  return false;
}

// ============================================
// SCÉNARIO 1: Création avec tarif manuel
// ============================================
async function testCreateWithManualTariff() {
  logTest('SCÉNARIO 1: Création avec tarif manuel');
  
  try {
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237611111111',
        items: 'Produit test 1',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'QuartierTest1',
        delivery_fee: 2000, // Tarif manuel
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création', createResponse.data);
      return false;
    }

    const delivery = createResponse.data.data || createResponse.data;
    const passed = assertEqual(delivery.delivery_fee, 2000, 'Tarif manuel correctement enregistré');
    return passed;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 2: Création avec tarif automatique (delivered)
// ============================================
async function testCreateWithAutoTariffDelivered() {
  logTest('SCÉNARIO 2: Création avec tarif automatique (status: delivered)');
  
  try {
    // Créer un tarif pour le quartier
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest2',
      tarif_amount: 1500,
    });

    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237622222222',
        items: 'Produit test 2',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered', // Status qui déclenche le tarif automatique
        quartier: 'QuartierTest2',
        // Pas de delivery_fee - doit être calculé automatiquement
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création', createResponse.data);
      return false;
    }

    const delivery = createResponse.data.data || createResponse.data;
    const passed1 = assertEqual(delivery.delivery_fee, 1500, 'Tarif automatique appliqué');
    const passed2 = assertEqual(delivery.amount_paid, 48500, 'amount_paid calculé (50000 - 1500)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 3: Création avec statut pickup
// ============================================
async function testCreateWithPickupStatus() {
  logTest('SCÉNARIO 3: Création avec statut pickup (tarif fixe 1000)');
  
  try {
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237633333333',
        items: 'Produit test 3',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pickup', // Statut qui applique tarif fixe 1000
        quartier: 'QuartierTest3',
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création', createResponse.data);
      return false;
    }

    const delivery = createResponse.data.data || createResponse.data;
    const passed1 = assertEqual(delivery.delivery_fee, 1000, 'Tarif pickup fixe appliqué (1000)');
    const passed2 = assertEqual(delivery.amount_paid, 49000, 'amount_paid calculé (50000 - 1000)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 4: Création avec statut client_absent
// ============================================
async function testCreateWithClientAbsentStatus() {
  logTest('SCÉNARIO 4: Création avec statut client_absent (amount_paid = 0)');
  
  try {
    // Créer un tarif pour le quartier
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest4',
      tarif_amount: 2000,
    });

    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237644444444',
        items: 'Produit test 4',
        amount_due: 50000,
        amount_paid: 10000, // Même si on met un montant, doit être forcé à 0
        status: 'client_absent',
        quartier: 'QuartierTest4',
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création', createResponse.data);
      return false;
    }

    const delivery = createResponse.data.data || createResponse.data;
    const passed1 = assertEqual(delivery.delivery_fee, 2000, 'Tarif automatique appliqué');
    const passed2 = assertEqual(delivery.amount_paid, 0, 'amount_paid forcé à 0 pour client_absent');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 5: Mise à jour statut vers delivered (avec tarif existant)
// ============================================
async function testUpdateStatusToDeliveredWithExistingTariff() {
  logTest('SCÉNARIO 5: Mise à jour statut vers delivered (préserve tarif manuel existant)');
  
  try {
    // Créer une livraison avec tarif manuel
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237655555555',
        items: 'Produit test 5',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'QuartierTest5',
        delivery_fee: 2500, // Tarif manuel
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;

    // Créer un tarif automatique pour ce quartier (différent)
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest5',
      tarif_amount: 1500, // Différent du tarif manuel
    });

    // Changer le statut vers delivered SANS renvoyer delivery_fee
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'delivered',
        // Pas de delivery_fee - doit préserver le tarif manuel existant
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed1 = assertEqual(updated.delivery_fee, 2500, 'Tarif manuel préservé (2500, pas 1500)');
    const passed2 = assertEqual(updated.amount_paid, 47500, 'amount_paid recalculé (50000 - 2500)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 6: Mise à jour statut vers delivered (sans tarif existant)
// ============================================
async function testUpdateStatusToDeliveredWithoutExistingTariff() {
  logTest('SCÉNARIO 6: Mise à jour statut vers delivered (applique tarif automatique)');
  
  try {
    // Créer une livraison sans tarif
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237666666666',
        items: 'Produit test 6',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'QuartierTest6',
        // Pas de delivery_fee
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;

    // Créer un tarif automatique pour ce quartier
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest6',
      tarif_amount: 1800,
    });

    // Changer le statut vers delivered
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'delivered',
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed1 = assertEqual(updated.delivery_fee, 1800, 'Tarif automatique appliqué');
    const passed2 = assertEqual(updated.amount_paid, 48200, 'amount_paid recalculé (50000 - 1800)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 7: Mise à jour de quartier (doit recalculer)
// ============================================
async function testUpdateQuartierRecalculatesTariff() {
  logTest('SCÉNARIO 7: Mise à jour de quartier (recalcule le tarif)');
  
  try {
    // Créer des tarifs pour deux quartiers différents
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest7A',
      tarif_amount: 1000,
    });
    
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest7B',
      tarif_amount: 3000,
    });

    // Créer une livraison avec le premier quartier
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237677777777',
        items: 'Produit test 7',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered',
        quartier: 'QuartierTest7A',
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;
    
    // Vérifier que le tarif initial est 1000
    assertEqual(delivery.delivery_fee, 1000, 'Tarif initial (QuartierTest7A: 1000)');

    // Changer le quartier vers le second (ne pas envoyer status si c'est déjà delivered)
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        quartier: 'QuartierTest7B',
        // Ne pas envoyer status si c'est déjà "delivered" pour éviter de déclencher statusChange.toDelivered
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed1 = assertEqual(updated.delivery_fee, 3000, 'Tarif recalculé pour nouveau quartier (3000)');
    const passed2 = assertEqual(updated.amount_paid, 47000, 'amount_paid recalculé (50000 - 3000)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 8: Mise à jour de amount_due (doit recalculer amount_paid)
// ============================================
async function testUpdateAmountDueRecalculatesAmountPaid() {
  logTest('SCÉNARIO 8: Mise à jour de amount_due (recalcule amount_paid)');
  
  try {
    // Créer une livraison avec tarif manuel
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237688888888',
        items: 'Produit test 8',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered',
        quartier: 'QuartierTest8',
        delivery_fee: 2000,
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;
    
    // Vérifier le montant initial
    assertEqual(delivery.amount_paid, 48000, 'amount_paid initial (50000 - 2000)');

    // Changer amount_due (ne pas envoyer status si c'est déjà delivered)
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount_due: 60000, // Nouveau montant
        delivery_fee: 2000, // Maintenir le tarif
        // Ne pas envoyer status si c'est déjà "delivered"
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed = assertEqual(updated.amount_paid, 58000, 'amount_paid recalculé (60000 - 2000)');
    return passed;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 9: Mise à jour de tarif manuel
// ============================================
async function testUpdateManualTariff() {
  logTest('SCÉNARIO 9: Mise à jour de tarif manuel explicite');
  
  try {
    // Créer une livraison avec tarif manuel
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237699999999',
        items: 'Produit test 9',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered',
        quartier: 'QuartierTest9',
        delivery_fee: 2000,
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;

    // Créer un tarif automatique (ne doit pas être utilisé)
    await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest9',
      tarif_amount: 1500,
    });

    // Mettre à jour avec un nouveau tarif manuel
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        delivery_fee: 3500, // Nouveau tarif manuel
        status: 'delivered',
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed1 = assertEqual(updated.delivery_fee, 3500, 'Nouveau tarif manuel appliqué (3500, pas 1500)');
    const passed2 = assertEqual(updated.amount_paid, 46500, 'amount_paid recalculé (50000 - 3500)');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 10: Changement vers client_absent
// ============================================
async function testUpdateToClientAbsent() {
  logTest('SCÉNARIO 10: Changement vers client_absent (force amount_paid = 0)');
  
  try {
    // Créer une livraison avec tarif
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237610101010',
        items: 'Produit test 10',
        amount_due: 50000,
        amount_paid: 48000, // Montant déjà payé
        status: 'delivered',
        quartier: 'QuartierTest10',
        delivery_fee: 2000,
        agency_id: testAgencyId,
      }),
    });

    const delivery = createResponse.data.data || createResponse.data;
    const deliveryId = delivery.id;

    // Changer vers client_absent
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'client_absent',
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updated = updateResponse.data.data || updateResponse.data;
    const passed1 = assertEqual(updated.delivery_fee, 2000, 'Tarif préservé');
    const passed2 = assertEqual(updated.amount_paid, 0, 'amount_paid forcé à 0 pour client_absent');
    return passed1 && passed2;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 11: Mise à jour de tarif dans table tarifs (affecte nouvelles livraisons)
// ============================================
async function testUpdateTariffTableAffectsNewDeliveries() {
  logTest('SCÉNARIO 11: Mise à jour de tarif dans table (affecte nouvelles livraisons)');
  
  try {
    // Créer un tarif initial
    const tariff = await createTariff({
      agency_id: testAgencyId,
      quartier: 'QuartierTest11',
      tarif_amount: 1000,
    });

    // Créer une livraison avec le tarif initial
    const createResponse1 = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237611111111',
        items: 'Produit test 11-1',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered',
        quartier: 'QuartierTest11',
        agency_id: testAgencyId,
      }),
    });

    const delivery1 = createResponse1.data.data || createResponse1.data;
    const passed0 = assertEqual(delivery1.delivery_fee, 1000, 'Première livraison avec tarif initial (1000)');
    if (!passed0) return false;

    // Mettre à jour le tarif dans la table
    // createTariff retourne directement l'ID (nombre), pas un objet
    const tariffId = typeof tariff === 'object' && tariff !== null ? (tariff.id || tariff) : tariff;
    
    if (!tariffId) {
      logFail('Impossible de récupérer l\'ID du tarif créé');
      return false;
    }
    
    const updateResult = await updateTariff(tariffId, {
      tarif_amount: 2500,
    });
    
    if (!updateResult || (updateResult.changes !== undefined && updateResult.changes === 0)) {
      logFail('La mise à jour du tarif a échoué ou n\'a pas modifié de ligne');
      return false;
    }
    
    logPass(`Tarif mis à jour dans la table (ID: ${tariffId}, nouveau montant: 2500)`);

    // Créer une nouvelle livraison - doit utiliser le nouveau tarif
    const createResponse2 = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237612121212',
        items: 'Produit test 11-2',
        amount_due: 50000,
        amount_paid: 0,
        status: 'delivered',
        quartier: 'QuartierTest11',
        agency_id: testAgencyId,
      }),
    });

    const delivery2 = createResponse2.data.data || createResponse2.data;
    const passed1 = assertEqual(delivery2.delivery_fee, 2500, 'Nouvelle livraison avec tarif mis à jour (2500)');
    const passed2 = assertEqual(delivery2.amount_paid, 47500, 'amount_paid calculé avec nouveau tarif (50000 - 2500)');
    
    // Vérifier que l'ancienne livraison n'a pas changé
    const oldDelivery = await getDeliveryById(delivery1.id);
    const old = Array.isArray(oldDelivery) ? oldDelivery[0] : oldDelivery;
    const passed3 = assertEqual(old.delivery_fee, 1000, 'Ancienne livraison non affectée (1000)');
    
    return passed1 && passed2 && passed3;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// ============================================
// SCÉNARIO 12: Statuts zone1 et zone2
// ============================================
async function testZone1AndZone2Statuses() {
  logTest('SCÉNARIO 12: Statuts zone1 et zone2 (tarifs fixes)');
  
  try {
    // Test zone1
    const createResponse1 = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237613131313',
        items: 'Produit test 12-1',
        amount_due: 50000,
        amount_paid: 10000,
        status: 'present_ne_decroche_zone1',
        quartier: 'QuartierTest12',
        agency_id: testAgencyId,
      }),
    });

    const delivery1 = createResponse1.data.data || createResponse1.data;
    const passed1 = assertEqual(delivery1.delivery_fee, 500, 'Tarif zone1 fixe (500)');
    const passed2 = assertEqual(delivery1.amount_paid, 0, 'amount_paid forcé à 0 pour zone1');

    // Test zone2
    const createResponse2 = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237614141414',
        items: 'Produit test 12-2',
        amount_due: 50000,
        amount_paid: 10000,
        status: 'present_ne_decroche_zone2',
        quartier: 'QuartierTest12',
        agency_id: testAgencyId,
      }),
    });

    const delivery2 = createResponse2.data.data || createResponse2.data;
    const passed3 = assertEqual(delivery2.delivery_fee, 1000, 'Tarif zone2 fixe (1000)');
    const passed4 = assertEqual(delivery2.amount_paid, 0, 'amount_paid forcé à 0 pour zone2');

    return passed1 && passed2 && passed3 && passed4;
  } catch (error) {
    logFail('Erreur', error.message);
    return false;
  }
}

// Fonction principale
async function runAllTests() {
  log('\n🚀 Suite de tests complète - Calculs automatiques de tarifs', 'blue');
  log(`📍 API Base URL: ${API_BASE_URL}${API_VERSION}\n`, 'yellow');
  
  // Se connecter
  const loggedIn = await login();
  if (!loggedIn) {
    log('❌ Impossible de se connecter. Les tests ne peuvent pas continuer.', 'red');
    process.exit(1);
  }
  
  if (!testAgencyId) {
    log('❌ L\'ID de l\'agence de test n\'est pas défini.', 'red');
    process.exit(1);
  }
  
  log(`✅ Authentifié avec succès (Agency ID: ${testAgencyId})\n`, 'green');
  
  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
    test6: false,
    test7: false,
    test8: false,
    test9: false,
    test10: false,
    test11: false,
    test12: false,
  };
  
  results.test1 = await testCreateWithManualTariff();
  results.test2 = await testCreateWithAutoTariffDelivered();
  results.test3 = await testCreateWithPickupStatus();
  results.test4 = await testCreateWithClientAbsentStatus();
  results.test5 = await testUpdateStatusToDeliveredWithExistingTariff();
  results.test6 = await testUpdateStatusToDeliveredWithoutExistingTariff();
  results.test7 = await testUpdateQuartierRecalculatesTariff();
  results.test8 = await testUpdateAmountDueRecalculatesAmountPaid();
  results.test9 = await testUpdateManualTariff();
  results.test10 = await testUpdateToClientAbsent();
  results.test11 = await testUpdateTariffTableAffectsNewDeliveries();
  results.test12 = await testZone1AndZone2Statuses();
  
  // Résumé
  log('\n' + '='.repeat(70), 'blue');
  log('📊 Résumé des tests', 'blue');
  log('='.repeat(70), 'blue');
  
  const testNames = [
    'Création avec tarif manuel',
    'Création avec tarif automatique (delivered)',
    'Création avec statut pickup',
    'Création avec statut client_absent',
    'Mise à jour vers delivered (préserve tarif manuel)',
    'Mise à jour vers delivered (applique tarif auto)',
    'Mise à jour de quartier (recalcule)',
    'Mise à jour de amount_due (recalcule)',
    'Mise à jour de tarif manuel',
    'Changement vers client_absent',
    'Mise à jour tarif table (affecte nouvelles)',
    'Statuts zone1 et zone2',
  ];
  
  let passedCount = 0;
  testNames.forEach((name, index) => {
    const key = `test${index + 1}`;
    const passed = results[key];
    if (passed) passedCount++;
    log(`${index + 1}. ${name}: ${passed ? '✅ PASSÉ' : '❌ ÉCHOUÉ'}`, passed ? 'green' : 'red');
  });
  
  log('='.repeat(70), 'blue');
  log(`Total: ${passedCount}/${testNames.length} tests passés`, passedCount === testNames.length ? 'green' : 'yellow');
  log('='.repeat(70) + '\n', 'blue');
  
  if (passedCount === testNames.length) {
    log('🎉 Tous les tests sont passés!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Certains tests ont échoué. Vérifiez les détails ci-dessus.', 'yellow');
    process.exit(1);
  }
}

// Vérifier que fetch est disponible
if (typeof fetch === 'undefined') {
  console.error('❌ fetch n\'est pas disponible. Node.js 18+ est requis.');
  process.exit(1);
}

// Lancer les tests
runAllTests().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
