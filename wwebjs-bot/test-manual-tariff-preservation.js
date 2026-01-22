/**
 * Test pour vérifier que le tarif manuel est préservé lors du changement de statut vers "delivered"
 */

const { getDeliveryById, updateDelivery, insertDelivery, createTariff, getTariffByAgencyAndQuartier, createAgency } = require('./src/db');
const { hashPassword } = require('./src/utils/password');
const path = require('path');

// Configuration de test
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';

// Token d'authentification et ID de l'agence de test
let authToken = null;
let testAgencyId = null;

// Helper pour faire des requêtes HTTP avec authentification
async function makeRequest(endpoint, options = {}, skipAuth = false) {
  const url = `${API_BASE_URL}${API_VERSION}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Ajouter le token d'authentification si disponible et si skipAuth est false
  if (!skipAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Pour les cookies HTTP-only
  });
  
  const data = await response.json().catch(() => ({}));
  return { response, data, status: response.status };
}

// Fonction pour créer un utilisateur de test
async function createTestUser() {
  log('  📝 Création d\'un utilisateur de test...');
  
  try {
    const testEmail = 'test-tariff@example.com';
    const testPassword = 'test123456';
    
    // Vérifier si l'utilisateur existe déjà
    const { adapter } = require('./src/db');
    const findQuery = adapter.type === 'postgres'
      ? `SELECT id FROM agencies WHERE email = $1 LIMIT 1`
      : `SELECT id FROM agencies WHERE email = ? LIMIT 1`;
    
    const existing = await adapter.query(findQuery, [testEmail]);
    
    // Handle array response (PostgreSQL) or object response (SQLite)
    const existingAgency = Array.isArray(existing) ? existing[0] : existing;
    
    if (existingAgency && (existingAgency.id || existingAgency)) {
      logPass(`Utilisateur de test existe déjà: ${testEmail}`);
      testAgencyId = existingAgency.id || existingAgency;
      logPass(`ID de l'agence: ${testAgencyId}`);
      return true;
    }
    
    // Créer l'utilisateur de test
    const passwordHash = await hashPassword(testPassword);
    const agency = await createAgency({
      name: 'Test Agency',
      email: testEmail,
      password_hash: passwordHash,
      role: 'agency',
      is_active: true,
    });
    
    testAgencyId = agency.id;
    logPass(`Utilisateur de test créé avec ID: ${testAgencyId}`);
    return true;
  } catch (error) {
    logFail('Erreur lors de la création de l\'utilisateur de test', error.message);
    return false;
  }
}

// Fonction pour se connecter
async function login() {
  log('  🔐 Connexion pour obtenir un token d\'authentification...');
  
  const testEmail = 'test-tariff@example.com';
  const testPassword = 'test123456';
  
  const loginResponse = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  }, true); // skipAuth = true pour la requête de login
  
  if (loginResponse.status === 200 && loginResponse.data.success) {
    // Le token est dans la réponse JSON (data.data.token)
    if (loginResponse.data.data && loginResponse.data.data.token) {
      authToken = loginResponse.data.data.token;
      logPass('Token obtenu avec succès');
      // Mettre à jour testAgencyId depuis la réponse
      if (loginResponse.data.data.user && loginResponse.data.data.user.id) {
        testAgencyId = loginResponse.data.data.user.id;
      }
      return true;
    } else if (loginResponse.data.token) {
      // Fallback pour une structure de réponse différente
      authToken = loginResponse.data.token;
      logPass('Token obtenu avec succès (format alternatif)');
      return true;
    } else {
      logFail('Token non trouvé dans la réponse de connexion');
      return false;
    }
  } else if (loginResponse.status === 401) {
    // L'utilisateur n'existe pas, on doit le créer
    const userCreated = await createTestUser();
    if (userCreated) {
      // Réessayer de se connecter
      return await login();
    }
    return false;
  }
  
  logFail('Échec de la connexion', loginResponse.data);
  return false;
}

// Helper pour logger
function log(message, color = 'white') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    white: '\x1b[0m',
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
}

function logTest(name) {
  log(`\n🧪 Test: ${name}`, 'blue');
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

// Test 1: Créer une livraison avec tarif manuel, puis changer le statut vers "delivered" sans renvoyer le tarif
async function testManualTariffPreservation() {
  logTest('Test 1: Préservation du tarif manuel lors du changement vers "delivered"');
  
  try {
    // Étape 1: Créer une livraison avec un tarif manuel
    log('  📝 Étape 1: Création d\'une livraison avec tarif manuel de 2000 FCFA');
    
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237612345678',
        items: 'Test produit',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'TestQuartier',
        delivery_fee: 2000, // Tarif manuel
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création de la livraison', createResponse.data);
      return false;
    }

    const createdDelivery = createResponse.data.data || createResponse.data;
    const deliveryId = createdDelivery.id;
    
    logPass(`Livraison créée avec ID: ${deliveryId}`);
    logPass(`Tarif initial: ${createdDelivery.delivery_fee} FCFA`);
    
    // Vérifier que le tarif a bien été enregistré
    if (parseFloat(createdDelivery.delivery_fee) !== 2000) {
      logFail(`Le tarif n'a pas été correctement enregistré. Attendu: 2000, Reçu: ${createdDelivery.delivery_fee}`);
      return false;
    }
    logPass('Tarif manuel correctement enregistré à la création');

    // Étape 2: Récupérer la livraison depuis la DB pour vérifier le tarif
    log('  📝 Étape 2: Vérification du tarif dans la base de données');
    const dbDelivery = await getDeliveryById(deliveryId);
    const delivery = Array.isArray(dbDelivery) ? dbDelivery[0] : dbDelivery;
    
    if (!delivery) {
      logFail('Impossible de récupérer la livraison depuis la DB');
      return false;
    }
    
    const dbDeliveryFee = parseFloat(delivery.delivery_fee) || 0;
    logPass(`Tarif dans la DB: ${dbDeliveryFee} FCFA`);
    
    if (dbDeliveryFee !== 2000) {
      logFail(`Le tarif dans la DB n'est pas correct. Attendu: 2000, Reçu: ${dbDeliveryFee}`);
      return false;
    }

    // Étape 3: Changer le statut vers "delivered" SANS renvoyer le delivery_fee
    log('  📝 Étape 3: Changement du statut vers "delivered" SANS renvoyer delivery_fee');
    
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'delivered',
        // Note: on ne renvoie PAS delivery_fee ici
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour du statut', updateResponse.data);
      return false;
    }

    const updatedDelivery = updateResponse.data.data || updateResponse.data;
    logPass(`Statut mis à jour vers: ${updatedDelivery.status}`);
    
    // Étape 4: Vérifier que le tarif manuel a été préservé
    log('  📝 Étape 4: Vérification que le tarif manuel a été préservé');
    const preservedFee = parseFloat(updatedDelivery.delivery_fee) || 0;
    logPass(`Tarif après mise à jour: ${preservedFee} FCFA`);
    
    if (preservedFee !== 2000) {
      logFail(`Le tarif manuel n'a PAS été préservé! Attendu: 2000, Reçu: ${preservedFee}`);
      logFail('Le tarif a probablement été remplacé par un tarif automatique ou mis à 0');
      return false;
    }
    
    logPass('✅ Le tarif manuel a été correctement préservé!');
    
    // Vérifier aussi dans la DB
    const dbUpdatedDelivery = await getDeliveryById(deliveryId);
    const finalDelivery = Array.isArray(dbUpdatedDelivery) ? dbUpdatedDelivery[0] : dbUpdatedDelivery;
    const finalDbFee = parseFloat(finalDelivery.delivery_fee) || 0;
    
    if (finalDbFee !== 2000) {
      logFail(`Le tarif dans la DB après mise à jour n'est pas correct. Attendu: 2000, Reçu: ${finalDbFee}`);
      return false;
    }
    
    logPass('✅ Le tarif dans la DB est également correct!');
    
    return true;
  } catch (error) {
    logFail('Erreur lors du test', error.message);
    console.error(error);
    return false;
  }
}

// Test 2: Vérifier que si un tarif automatique existe, il n'écrase pas le tarif manuel
async function testManualTariffOverridesAutomatic() {
  logTest('Test 2: Le tarif manuel ne doit pas être écrasé par un tarif automatique');
  
  try {
    // Étape 1: Créer un tarif automatique pour le quartier
    log('  📝 Étape 1: Création d\'un tarif automatique de 1500 FCFA pour TestQuartier');
    
    const tariffResult = await createTariff({
      agency_id: testAgencyId,
      quartier: 'TestQuartier',
      tarif_amount: 1500,
    });
    
    logPass('Tarif automatique créé: 1500 FCFA');

    // Étape 2: Créer une livraison avec un tarif manuel différent (2000)
    log('  📝 Étape 2: Création d\'une livraison avec tarif manuel de 2000 FCFA (différent du tarif automatique)');
    
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237612345679',
        items: 'Test produit 2',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'TestQuartier',
        delivery_fee: 2000, // Tarif manuel (différent du tarif automatique de 1500)
        agency_id: testAgencyId,
      }),
    });

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      logFail('Échec de la création de la livraison', createResponse.data);
      return false;
    }

    const createdDelivery = createResponse.data.data || createResponse.data;
    const deliveryId = createdDelivery.id;
    
    logPass(`Livraison créée avec ID: ${deliveryId}`);
    logPass(`Tarif manuel: ${createdDelivery.delivery_fee} FCFA (devrait être 2000, pas 1500)`);
    
    if (parseFloat(createdDelivery.delivery_fee) !== 2000) {
      logFail(`Le tarif manuel n'a pas été correctement enregistré. Attendu: 2000, Reçu: ${createdDelivery.delivery_fee}`);
      return false;
    }

    // Étape 3: Changer le statut vers "delivered" sans renvoyer le delivery_fee
    log('  📝 Étape 3: Changement du statut vers "delivered" (le tarif automatique de 1500 ne doit PAS remplacer le tarif manuel de 2000)');
    
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'delivered',
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour du statut', updateResponse.data);
      return false;
    }

    const updatedDelivery = updateResponse.data.data || updateResponse.data;
    const preservedFee = parseFloat(updatedDelivery.delivery_fee) || 0;
    
    logPass(`Tarif après mise à jour: ${preservedFee} FCFA`);
    
    if (preservedFee !== 2000) {
      logFail(`Le tarif manuel a été écrasé par le tarif automatique! Attendu: 2000 (manuel), Reçu: ${preservedFee}`);
      if (preservedFee === 1500) {
        logFail('Le tarif automatique de 1500 a remplacé le tarif manuel de 2000 - C\'EST LE PROBLÈME!');
      }
      return false;
    }
    
    logPass('✅ Le tarif manuel (2000) a été préservé et n\'a pas été écrasé par le tarif automatique (1500)!');
    
    return true;
  } catch (error) {
    logFail('Erreur lors du test', error.message);
    console.error(error);
    return false;
  }
}

// Test 3: Vérifier que si on renvoie explicitement un nouveau tarif, il est utilisé
async function testExplicitTariffUpdate() {
  logTest('Test 3: Si on renvoie explicitement un nouveau tarif, il doit être utilisé');
  
  try {
    // Étape 1: Créer une livraison avec tarif manuel de 2000
    log('  📝 Étape 1: Création d\'une livraison avec tarif manuel de 2000 FCFA');
    
    const createResponse = await makeRequest('/deliveries', {
      method: 'POST',
      body: JSON.stringify({
        phone: '+237612345680',
        items: 'Test produit 3',
        amount_due: 50000,
        amount_paid: 0,
        status: 'pending',
        quartier: 'TestQuartier',
        delivery_fee: 2000,
        agency_id: testAgencyId,
      }),
    });

    const createdDelivery = createResponse.data.data || createResponse.data;
    const deliveryId = createdDelivery.id;

    // Étape 2: Changer le statut vers "delivered" ET renvoyer un nouveau tarif (3000)
    log('  📝 Étape 2: Changement du statut vers "delivered" avec un nouveau tarif de 3000 FCFA');
    
    const updateResponse = await makeRequest(`/deliveries/${deliveryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'delivered',
        delivery_fee: 3000, // Nouveau tarif explicite
      }),
    });

    if (updateResponse.status !== 200) {
      logFail('Échec de la mise à jour', updateResponse.data);
      return false;
    }

    const updatedDelivery = updateResponse.data.data || updateResponse.data;
    const newFee = parseFloat(updatedDelivery.delivery_fee) || 0;
    
    if (newFee !== 3000) {
      logFail(`Le nouveau tarif n'a pas été appliqué. Attendu: 3000, Reçu: ${newFee}`);
      return false;
    }
    
    logPass('✅ Le nouveau tarif explicite (3000) a été correctement appliqué!');
    
    return true;
  } catch (error) {
    logFail('Erreur lors du test', error.message);
    console.error(error);
    return false;
  }
}

// Fonction principale
async function runAllTests() {
  log('\n🚀 Tests de préservation du tarif manuel', 'blue');
  log(`📍 API Base URL: ${API_BASE_URL}${API_VERSION}\n`, 'yellow');
  
  // Se connecter d'abord
  const loggedIn = await login();
  if (!loggedIn || !authToken) {
    log('❌ Impossible de se connecter. Les tests ne peuvent pas continuer.', 'red');
    log('💡 Assurez-vous que le serveur backend est démarré et qu\'un utilisateur de test existe.', 'yellow');
    process.exit(1);
  }
  
  if (!testAgencyId) {
    log('❌ L\'ID de l\'agence de test n\'est pas défini. Les tests ne peuvent pas continuer.', 'red');
    process.exit(1);
  }
  
  log(`✅ Authentifié avec succès (Agency ID: ${testAgencyId})\n`, 'green');
  
  const results = {
    test1: false,
    test2: false,
    test3: false,
  };
  
  results.test1 = await testManualTariffPreservation();
  results.test2 = await testManualTariffOverridesAutomatic();
  results.test3 = await testExplicitTariffUpdate();
  
  // Résumé
  log('\n' + '='.repeat(60), 'blue');
  log('📊 Résumé des tests', 'blue');
  log('='.repeat(60), 'blue');
  log(`Test 1 (Préservation tarif manuel): ${results.test1 ? '✅ PASSÉ' : '❌ ÉCHOUÉ'}`, results.test1 ? 'green' : 'red');
  log(`Test 2 (Tarif manuel > tarif automatique): ${results.test2 ? '✅ PASSÉ' : '❌ ÉCHOUÉ'}`, results.test2 ? 'green' : 'red');
  log(`Test 3 (Mise à jour explicite): ${results.test3 ? '✅ PASSÉ' : '❌ ÉCHOUÉ'}`, results.test3 ? 'green' : 'red');
  log('='.repeat(60) + '\n', 'blue');
  
  const allPassed = results.test1 && results.test2 && results.test3;
  
  if (allPassed) {
    log('🎉 Tous les tests sont passés!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Certains tests ont échoué. Vérifiez les détails ci-dessus.', 'yellow');
    process.exit(1);
  }
}

// Vérifier que fetch est disponible (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ fetch n\'est pas disponible. Node.js 18+ est requis.');
  process.exit(1);
}

// Lancer les tests
runAllTests().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
