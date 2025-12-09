const { adapter, close } = require("./db");
const config = require("./config");

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("📦 TOUTES LES LIVRAISONS");
  console.log("=".repeat(70) + "\n");

  // Get command line arguments for filtering
  const args = process.argv.slice(2);
  const dateFilter = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const statusFilter = args.find(arg => arg.startsWith('--status='))?.split('=')[1];
  const phoneFilter = args.find(arg => arg.startsWith('--phone='))?.split('=')[1];

  // Build query
  let query = "SELECT * FROM deliveries WHERE 1=1";
  const params = [];

  if (dateFilter) {
    query += " AND DATE(created_at) = DATE(?)";
    params.push(dateFilter);
  }

  if (statusFilter) {
    query += " AND status = ?";
    params.push(statusFilter);
  }

  if (phoneFilter) {
    query += " AND phone LIKE ?";
    params.push(`%${phoneFilter}%`);
  }

  query += " ORDER BY created_at DESC";

  // Execute query based on database type
  let deliveries;
  if (config.DB_TYPE === "postgres") {
    // Convert placeholders for PostgreSQL
    const pgQuery = query.replace(/\?/g, (match, offset) => {
      const index = query.substring(0, offset).split("?").length;
      return `$${index}`;
    });
    deliveries = await adapter.query(pgQuery, params);
  } else {
    deliveries = await adapter.query(query, params);
  }

  // Get overall statistics
  const statsQuery = `
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END) as pickup,
    SUM(amount_paid) as total_collected,
    SUM(amount_due) as total_due,
    SUM(amount_due - amount_paid) as total_remaining
  FROM deliveries
`;

  let allStats;
  const statsResult = await adapter.query(statsQuery);
  
  // Handle both PostgreSQL (array) and SQLite (object) return formats
  if (Array.isArray(statsResult) && statsResult.length > 0) {
    allStats = statsResult[0];
  } else if (statsResult) {
    allStats = statsResult;
  } else {
    // Default empty stats
    allStats = {
      total: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      pickup: 0,
      total_collected: 0,
      total_due: 0,
      total_remaining: 0
    };
  }

  if (deliveries.length === 0) {
    console.log("Aucune livraison trouvée avec les filtres sélectionnés.\n");
    
    if (dateFilter || statusFilter || phoneFilter) {
      console.log("💡 Filtres appliqués:");
      if (dateFilter) console.log(`   Date: ${dateFilter}`);
      if (statusFilter) console.log(`   Statut: ${statusFilter}`);
      if (phoneFilter) console.log(`   Téléphone: ${phoneFilter}`);
      console.log("\n💡 Pour voir toutes les livraisons: npm run view:all");
      console.log("💡 Pour voir aujourd'hui: npm run view\n");
    }
  } else {
    // Show filter info
    if (dateFilter || statusFilter || phoneFilter) {
      console.log("🔍 Filtres appliqués:");
      if (dateFilter) console.log(`   📅 Date: ${dateFilter}`);
      if (statusFilter) console.log(`   📊 Statut: ${statusFilter}`);
      if (phoneFilter) console.log(`   📱 Téléphone: ${phoneFilter}`);
      console.log("");
    }

    console.log(`📊 Statistiques Globales:`);
    console.log(`   📦 Total de livraisons: ${allStats.total}`);
    console.log(`   ✅ Livrées: ${allStats.delivered || 0}`);
    console.log(`   ⏳ En attente: ${allStats.pending || 0}`);
    console.log(`   📦 Pickup: ${allStats.pickup || 0}`);
    console.log(`   ❌ Échecs: ${allStats.failed || 0}`);
    console.log(`   💰 Total dû: ${allStats.total_due || 0} FCFA`);
    console.log(`   💵 Total collecté: ${allStats.total_collected || 0} FCFA`);
    console.log(`   💸 Restant: ${allStats.total_remaining || 0} FCFA\n`);

    console.log(`📋 Livraisons trouvées (${deliveries.length}):\n`);

    deliveries.forEach((delivery, index) => {
      console.log(`${index + 1}. Livraison #${delivery.id}`);
      console.log(`   📱 Numéro: ${delivery.phone}`);
      if (delivery.customer_name) {
        console.log(`   👤 Client: ${delivery.customer_name}`);
      }
      console.log(`   📦 Produits: ${delivery.items}`);
      console.log(`   💰 Montant dû: ${delivery.amount_due} FCFA`);
      if (delivery.amount_paid > 0) {
        console.log(`   💵 Payé: ${delivery.amount_paid} FCFA`);
        const remaining = delivery.amount_due - delivery.amount_paid;
        if (remaining > 0) {
          console.log(`   💸 Restant: ${remaining} FCFA`);
        }
      }
      console.log(`   📍 Quartier: ${delivery.quartier || "Non spécifié"}`);
      
      // Status with emoji
      const statusEmoji = {
        'delivered': '✅',
        'failed': '❌',
        'pending': '⏳',
        'pickup': '📦'
      };
      const emoji = statusEmoji[delivery.status] || '📋';
      console.log(`   ${emoji} Statut: ${delivery.status}`);
      
      if (delivery.carrier) {
        console.log(`   🚚 Transporteur: ${delivery.carrier}`);
      }
      if (delivery.notes) {
        console.log(`   📝 Notes: ${delivery.notes.substring(0, 100)}${delivery.notes.length > 100 ? '...' : ''}`);
      }
      console.log(`   🕐 Créé: ${new Date(delivery.created_at).toLocaleString("fr-FR")}`);
      console.log(`   🕐 Modifié: ${new Date(delivery.updated_at).toLocaleString("fr-FR")}`);
      console.log("");
    });
  }

  console.log("=".repeat(70));
  console.log("💡 Commandes disponibles:");
  console.log("   npm run view:all              - Voir toutes les livraisons");
  console.log("   npm run view:all --status=pending  - Filtrer par statut");
  console.log("   npm run view:all --date=2024-01-15  - Filtrer par date");
  console.log("   npm run view:all --phone=612345678  - Chercher par téléphone");
  console.log("=".repeat(70) + "\n");

  // Close database connection
  await close();
}

main().catch(console.error);

