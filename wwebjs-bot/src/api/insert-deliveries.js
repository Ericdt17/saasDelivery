/**
 * Script to insert 20 deliveries via the API bulk endpoint
 * Usage: node src/api/insert-deliveries.js
 */

const http = require('http');

const deliveries = [
  {
    phone: "612345678",
    items: "2 robes + 1 sac",
    amount_due: 15000,
    amount_paid: 0,
    status: "pending",
    quartier: "Bonapriso",
    notes: "Customer prefers morning delivery"
  },
  {
    phone: "698765432",
    items: "3 chemises",
    amount_due: 20000,
    amount_paid: 5000,
    status: "pending",
    quartier: "Akwa",
    carrier: "Express Delivery"
  },
  {
    phone: "655444333",
    items: "1 pantalon + 2 t-shirts",
    amount_due: 25000,
    amount_paid: 0,
    status: "pending",
    quartier: "Makepe",
    notes: "Fragile items"
  },
  {
    phone: "677888999",
    items: "5 articles divers",
    amount_due: 30000,
    amount_paid: 10000,
    status: "pending",
    quartier: "Bepanda"
  },
  {
    phone: "644555666",
    items: "1 costume complet",
    amount_due: 45000,
    amount_paid: 0,
    status: "pending",
    quartier: "Douala Centre",
    carrier: "Fast Track"
  },
  {
    phone: "611222333",
    items: "4 robes",
    amount_due: 35000,
    amount_paid: 35000,
    status: "pickup",
    quartier: "Bali",
    notes: "Fully paid, ready for delivery"
  },
  {
    phone: "622333444",
    items: "2 pantalons",
    amount_due: 18000,
    amount_paid: 9000,
    status: "pickup",
    quartier: "New Bell",
    carrier: "Standard Delivery"
  },
  {
    phone: "633444555",
    items: "1 robe de soirée",
    amount_due: 50000,
    amount_paid: 25000,
    status: "pickup",
    quartier: "Bonanjo",
    notes: "High value item"
  },
  {
    phone: "644555777",
    items: "3 chemises + 2 cravates",
    amount_due: 28000,
    amount_paid: 28000,
    status: "pickup",
    quartier: "Logpom"
  },
  {
    phone: "655666888",
    items: "6 articles enfants",
    amount_due: 22000,
    amount_paid: 0,
    status: "pickup",
    quartier: "Kotto",
    carrier: "Express Delivery"
  },
  {
    phone: "666777999",
    items: "2 costumes",
    amount_due: 90000,
    amount_paid: 90000,
    status: "delivered",
    quartier: "Deido",
    notes: "Delivered on time"
  },
  {
    phone: "677888111",
    items: "4 robes + 2 sacs",
    amount_due: 55000,
    amount_paid: 55000,
    status: "delivered",
    quartier: "Wouri"
  },
  {
    phone: "688999222",
    items: "1 complet + 3 chemises",
    amount_due: 75000,
    amount_paid: 75000,
    status: "delivered",
    quartier: "Pk8",
    carrier: "Premium Delivery"
  },
  {
    phone: "699111333",
    items: "5 robes",
    amount_due: 40000,
    amount_paid: 40000,
    status: "delivered",
    quartier: "Mbanga",
    notes: "Customer satisfied"
  },
  {
    phone: "611333555",
    items: "2 pantalons + 1 veste",
    amount_due: 32000,
    amount_paid: 32000,
    status: "delivered",
    quartier: "Nkongsamba"
  },
  {
    phone: "622444666",
    items: "3 chemises",
    amount_due: 24000,
    amount_paid: 12000,
    status: "failed",
    quartier: "Limbe",
    notes: "Wrong address, customer not found"
  },
  {
    phone: "633555777",
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
    items: "4 t-shirts",
    amount_due: 15000,
    amount_paid: 0,
    status: "failed",
    quartier: "Kribi",
    notes: "Package damaged, return to sender"
  },
  {
    phone: "655777999",
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
    items: "1 costume premium",
    amount_due: 150000,
    amount_paid: 150000,
    status: "delivered",
    quartier: "Yaoundé",
    carrier: "Premium Express",
    notes: "VIP customer, urgent delivery"
  }
];

async function insertDeliveries() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${API_URL}/api/v1/deliveries/bulk`;

  console.log('\n' + '='.repeat(70));
  console.log('📦 BULK INSERT DELIVERIES');
  console.log('='.repeat(70));
  console.log(`📡 API URL: ${endpoint}`);
  console.log(`📊 Total deliveries to insert: ${deliveries.length}\n`);

  const requestData = JSON.stringify({ deliveries });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/deliveries/bulk',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk.toString();
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(body);

          if (res.statusCode === 201 || (res.statusCode === 200 && result.success)) {
            console.log('✅ SUCCESS!\n');
            console.log(`📊 Created: ${result.created} deliveries`);
            console.log(`❌ Failed: ${result.failed} deliveries`);
            console.log(`\n📝 Message: ${result.message}\n`);

            if (result.results.success.length > 0) {
              console.log('✅ Successful deliveries:');
              result.results.success.forEach((item) => {
                console.log(`   ${item.index + 1}. Delivery ID: ${item.id} - Phone: ${item.data.phone} - ${item.data.items}`);
              });
            }

            if (result.results.failed.length > 0) {
              console.log('\n❌ Failed deliveries:');
              result.results.failed.forEach((item) => {
                console.log(`   ${item.index + 1}. Error: ${item.error}`);
              });
            }

            console.log('\n' + '='.repeat(70));
            console.log('✨ Bulk insert completed!\n');
            resolve(result);
          } else {
            console.error('❌ ERROR:\n');
            console.error(result);
            reject(new Error(result.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('❌ Failed to parse response:', error.message);
          console.error('Response body:', body);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request failed:');
      console.error(`   Error: ${error.message}`);
      console.error(`   💡 Make sure the API server is running: npm run api`);
      console.error(`   💡 Check if port 3000 is available\n`);
      reject(error);
    });

    req.write(requestData);
    req.end();
  });
}

// Run if called directly
if (require.main === module) {
  insertDeliveries()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { insertDeliveries, deliveries };










