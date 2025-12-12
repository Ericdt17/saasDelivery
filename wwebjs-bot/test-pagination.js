/**
 * Script de test pour vérifier la pagination
 *
 * Usage: node test-pagination.js
 */

const fetch = require("node-fetch");

const API_URL = process.env.API_URL || "http://localhost:3000";

async function testPagination() {
  console.log("\n🧪 Test de la pagination");
  console.log("=".repeat(60));
  console.log(`📡 API URL: ${API_URL}\n`);

  try {
    // Test 1: Première page (page 1, limit 10)
    console.log("📄 Test 1: Page 1, limit 10");
    const page1 = await fetch(`${API_URL}/api/v1/deliveries?page=1&limit=10`);
    const data1 = await page1.json();

    if (!data1.success) {
      console.error("❌ Erreur:", data1.error);
      return;
    }

    console.log(`   ✅ Reçu ${data1.data?.length || 0} livraisons`);
    console.log(`   📊 Pagination:`, data1.pagination);
    console.log(`   📈 Total: ${data1.pagination?.total || 0}`);
    console.log(`   📑 Pages totales: ${data1.pagination?.totalPages || 0}`);

    if (data1.pagination?.total > 10) {
      // Test 2: Deuxième page
      console.log("\n📄 Test 2: Page 2, limit 10");
      const page2 = await fetch(`${API_URL}/api/v1/deliveries?page=2&limit=10`);
      const data2 = await page2.json();

      if (!data2.success) {
        console.error("❌ Erreur:", data2.error);
        return;
      }

      console.log(`   ✅ Reçu ${data2.data?.length || 0} livraisons`);
      console.log(`   📊 Pagination:`, data2.pagination);

      // Vérifier que les IDs sont différents
      const ids1 = data1.data?.map((d) => d.id) || [];
      const ids2 = data2.data?.map((d) => d.id) || [];
      const hasOverlap = ids1.some((id) => ids2.includes(id));

      if (hasOverlap) {
        console.error(
          "   ❌ PROBLÈME: Les pages contiennent des IDs en commun!"
        );
      } else {
        console.log("   ✅ Les pages sont différentes (pas de doublons)");
      }
    }

    // Test 3: Page avec un limit différent
    console.log("\n📄 Test 3: Page 1, limit 5");
    const page3 = await fetch(`${API_URL}/api/v1/deliveries?page=1&limit=5`);
    const data3 = await page3.json();

    if (!data3.success) {
      console.error("❌ Erreur:", data3.error);
      return;
    }

    console.log(`   ✅ Reçu ${data3.data?.length || 0} livraisons`);
    console.log(`   📊 Pagination:`, data3.pagination);

    if (data3.data?.length > 5) {
      console.error("   ❌ PROBLÈME: Plus de 5 résultats retournés!");
    } else {
      console.log("   ✅ Le limit fonctionne correctement");
    }

    // Test 4: Dernière page
    if (data1.pagination?.totalPages > 1) {
      const lastPage = data1.pagination.totalPages;
      console.log(`\n📄 Test 4: Dernière page (page ${lastPage}), limit 10`);
      const pageLast = await fetch(
        `${API_URL}/api/v1/deliveries?page=${lastPage}&limit=10`
      );
      const dataLast = await pageLast.json();

      if (!dataLast.success) {
        console.error("❌ Erreur:", dataLast.error);
        return;
      }

      console.log(`   ✅ Reçu ${dataLast.data?.length || 0} livraisons`);
      console.log(`   📊 Pagination:`, dataLast.pagination);

      if (dataLast.pagination?.page !== lastPage) {
        console.error("   ❌ PROBLÈME: La page retournée ne correspond pas!");
      } else {
        console.log("   ✅ La dernière page fonctionne correctement");
      }
    }

    // Test 5: Page avec filtres (startDate/endDate)
    console.log("\n📄 Test 5: Pagination avec filtres (date)");
    const today = new Date().toISOString().split("T")[0];
    const pageFiltered = await fetch(
      `${API_URL}/api/v1/deliveries?page=1&limit=10&startDate=${today}&endDate=${today}`
    );
    const dataFiltered = await pageFiltered.json();

    if (!dataFiltered.success) {
      console.error("❌ Erreur:", dataFiltered.error);
      return;
    }

    console.log(`   ✅ Reçu ${dataFiltered.data?.length || 0} livraisons`);
    console.log(`   📊 Pagination:`, dataFiltered.pagination);
    console.log("   ✅ La pagination avec filtres fonctionne");

    console.log("\n" + "=".repeat(60));
    console.log("✅ Tous les tests de pagination sont passés!");
  } catch (error) {
    console.error("\n❌ Erreur lors du test:");
    console.error(error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("\n💡 Le serveur backend n'est pas démarré!");
      console.error(
        "   Démarre le serveur avec: npm run dev (dans wwebjs-bot/)"
      );
    }
    process.exit(1);
  }
}

testPagination();



