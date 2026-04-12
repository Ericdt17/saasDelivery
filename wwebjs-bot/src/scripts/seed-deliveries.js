/**
 * Seed script to create 20 deliveries with different scenarios
 * Usage: node src/api/seed-deliveries.js
 */

const deliveries = [
  // Scenario 1-5: Pending deliveries (different amounts and items)
  {
    phone: "612345678",
    customer_name: "Jean Dupont",
    items: "2 robes + 1 sac",
    amount_due: 15000,
    amount_paid: 0,
    status: "pending",
    quartier: "Bonapriso",
    notes: "Customer prefers morning delivery"
  },
  {
    phone: "698765432",
    customer_name: "Marie Martin",
    items: "3 chemises",
    amount_due: 20000,
    amount_paid: 5000,
    status: "pending",
    quartier: "Akwa",
    carrier: "Express Delivery"
  },
  {
    phone: "655444333",
    customer_name: "Pierre Kouam",
    items: "1 pantalon + 2 t-shirts",
    amount_due: 25000,
    amount_paid: 0,
    status: "pending",
    quartier: "Makepe",
    notes: "Fragile items"
  },
  {
    phone: "677888999",
    customer_name: "Sophie Ngono",
    items: "5 articles divers",
    amount_due: 30000,
    amount_paid: 10000,
    status: "pending",
    quartier: "Bepanda"
  },
  {
    phone: "644555666",
    customer_name: "David Mbarga",
    items: "1 costume complet",
    amount_due: 45000,
    amount_paid: 0,
    status: "pending",
    quartier: "Douala Centre",
    carrier: "Fast Track"
  },

  // Scenario 6-10: Pickup status (items picked up but not delivered)
  {
    phone: "611222333",
    customer_name: "Anna Tchouassi",
    items: "4 robes",
    amount_due: 35000,
    amount_paid: 35000,
    status: "pickup",
    quartier: "Bali",
    notes: "Fully paid, ready for delivery"
  },
  {
    phone: "622333444",
    customer_name: "Paul Fokou",
    items: "2 pantalons",
    amount_due: 18000,
    amount_paid: 9000,
    status: "pickup",
    quartier: "New Bell",
    carrier: "Standard Delivery"
  },
  {
    phone: "633444555",
    customer_name: "Lucie Bikoko",
    items: "1 robe de soirée",
    amount_due: 50000,
    amount_paid: 25000,
    status: "pickup",
    quartier: "Bonanjo",
    notes: "High value item"
  },
  {
    phone: "644555777",
    customer_name: "Eric Nkeng",
    items: "3 chemises + 2 cravates",
    amount_due: 28000,
    amount_paid: 28000,
    status: "pickup",
    quartier: "Logpom"
  },
  {
    phone: "655666888",
    customer_name: "Grace Manga",
    items: "6 articles enfants",
    amount_due: 22000,
    amount_paid: 0,
    status: "pickup",
    quartier: "Kotto",
    carrier: "Express Delivery"
  },

  // Scenario 11-15: Delivered successfully
  {
    phone: "666777999",
    customer_name: "Thomas Ndi",
    items: "2 costumes",
    amount_due: 90000,
    amount_paid: 90000,
    status: "delivered",
    quartier: "Deido",
    notes: "Delivered on time"
  },
  {
    phone: "677888111",
    customer_name: "Claire Mboumba",
    items: "4 robes + 2 sacs",
    amount_due: 55000,
    amount_paid: 55000,
    status: "delivered",
    quartier: "Wouri"
  },
  {
    phone: "688999222",
    customer_name: "Marc Ebongue",
    items: "1 complet + 3 chemises",
    amount_due: 75000,
    amount_paid: 75000,
    status: "delivered",
    quartier: "Pk8",
    carrier: "Premium Delivery"
  },
  {
    phone: "699111333",
    customer_name: "Jacqueline Ngué",
    items: "5 robes",
    amount_due: 40000,
    amount_paid: 40000,
    status: "delivered",
    quartier: "Mbanga",
    notes: "Customer satisfied"
  },
  {
    phone: "611333555",
    customer_name: "Daniel Mfoumbou",
    items: "2 pantalons + 1 veste",
    amount_due: 32000,
    amount_paid: 32000,
    status: "delivered",
    quartier: "Nkongsamba"
  },

  // Scenario 16-18: Failed deliveries
  {
    phone: "622444666",
    customer_name: "Patrice Ngo",
    items: "3 chemises",
    amount_due: 24000,
    amount_paid: 12000,
    status: "failed",
    quartier: "Limbe",
    notes: "Wrong address, customer not found"
  },
  {
    phone: "633555777",
    customer_name: "Ruth Mbeki",
    items: "1 robe de mariée",
    amount_due: 120000,
    amount_paid: 60000,
    status: "failed",
    quartier: "Buea",
    carrier: "Special Delivery",
    notes: "Customer canceled order"
  },
  {
    phone: "644666888",
    customer_name: "Samuel Tcheuko",
    items: "4 t-shirts",
    amount_due: 15000,
    amount_paid: 0,
    status: "failed",
    quartier: "Kribi",
    notes: "Package damaged, return to sender"
  },

  // Scenario 19-20: Special cases
  {
    phone: "655777999",
    customer_name: "Esther Mbala",
    items: "10 articles divers",
    amount_due: 85000,
    amount_paid: 50000,
    status: "pending",
    quartier: "Edea",
    carrier: "Bulk Delivery",
    notes: "Large order, partial payment received"
  },
  {
    phone: "666888111",
    customer_name: "André Mvondo",
    items: "1 costume premium",
    amount_due: 150000,
    amount_paid: 150000,
    status: "delivered",
    quartier: "Yaoundé",
    carrier: "Premium Express",
    notes: "VIP customer, urgent delivery"
  }
];

async function seedDeliveries() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  console.log('\n' + '='.repeat(70));
  console.log('🌱 SEEDING DELIVERIES DATABASE');
  console.log('='.repeat(70) + '\n');
  console.log(`📡 API URL: ${API_URL}/api/v1/deliveries\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < deliveries.length; i++) {
    const delivery = deliveries[i];
    const deliveryNum = i + 1;

    try {
      // Use fetch if available (Node.js 18+) or need node-fetch
      let response;
      
      if (typeof fetch !== 'undefined') {
        response = await fetch(`${API_URL}/api/v1/deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(delivery),
        });
      } else {
        // Fallback for older Node.js versions - use http module
        const http = require('http');
        const data = JSON.stringify(delivery);
        
        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/v1/deliveries',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          },
        };

        response = await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
              res.body = body;
              resolve(res);
            });
          });
          req.on('error', reject);
          req.write(data);
          req.end();
        });
      }

      const result = typeof fetch !== 'undefined' 
        ? await response.json()
        : JSON.parse(response.body);

      if (result.success) {
        console.log(`✅ Delivery #${deliveryNum} created: ID ${result.data.id}`);
        console.log(`   📱 ${delivery.phone} | ${delivery.items} | ${delivery.status} | ${delivery.amount_due} FCFA`);
        successCount++;
      } else {
        console.error(`❌ Delivery #${deliveryNum} failed: ${result.error}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Delivery #${deliveryNum} error:`, error.message);
      errorCount++;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Success: ${successCount}/${deliveries.length}`);
  console.log(`❌ Errors: ${errorCount}/${deliveries.length}`);
  console.log('='.repeat(70) + '\n');
}

// Run if called directly
if (require.main === module) {
  seedDeliveries()
    .then(() => {
      console.log('✨ Seeding complete!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDeliveries, deliveries };

