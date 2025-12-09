/**
 * Daily Report Generator
 * Generates and optionally sends daily delivery reports
 */

const { getTodayDeliveries, getDeliveryStats } = require("./db");
const { adapter } = require("./db");
const config = require("./config");
const fs = require("fs");
const path = require("path");

async function generateDailyReport(date = null) {
  // If no date specified, use today
  const targetDate = date || new Date().toISOString().split("T")[0];
  
  console.log("\n" + "=".repeat(70));
  console.log(`📊 RAPPORT QUOTIDIEN - ${targetDate}`);
  console.log("=".repeat(70) + "\n");

  try {
    // Get deliveries for the date
    const stats = await getDeliveryStats(targetDate);
    const deliveries = targetDate === new Date().toISOString().split("T")[0]
      ? await getTodayDeliveries()
      : await getDeliveriesByDate(targetDate);

    // Generate report text
    let report = `📊 RAPPORT QUOTIDIEN - ${targetDate}\n`;
    report += "=".repeat(50) + "\n\n";

    report += `📦 STATISTIQUES:\n`;
    report += `   Total de livraisons: ${stats.total || 0}\n`;
    report += `   ✅ Livrées: ${stats.delivered || 0}\n`;
    report += `   ⏳ En attente: ${stats.pending || 0}\n`;
    report += `   📦 Pickup: ${stats.pickup || 0}\n`;
    report += `   ❌ Échecs: ${stats.failed || 0}\n`;
    report += `   💰 Total dû: ${stats.total_due || 0} FCFA\n`;
    report += `   💵 Total collecté: ${stats.total_collected || 0} FCFA\n`;
    report += `   💸 Restant: ${stats.total_remaining || 0} FCFA\n\n`;

    if (deliveries.length > 0) {
      report += `📋 DÉTAILS DES LIVRAISONS (${deliveries.length}):\n\n`;
      
      deliveries.forEach((delivery, index) => {
        const statusEmoji = {
          'delivered': '✅',
          'failed': '❌',
          'pending': '⏳',
          'pickup': '📦'
        };
        const emoji = statusEmoji[delivery.status] || '📋';

        report += `${index + 1}. Livraison #${delivery.id} ${emoji}\n`;
        report += `   📱 ${delivery.phone}\n`;
        report += `   📦 ${delivery.items}\n`;
        report += `   💰 ${delivery.amount_due} FCFA`;
        if (delivery.amount_paid > 0) {
          report += ` (Payé: ${delivery.amount_paid} FCFA)`;
        }
        report += `\n`;
        report += `   📍 ${delivery.quartier || "Non spécifié"}\n`;
        report += `   📊 ${delivery.status}\n\n`;
      });
    } else {
      report += `Aucune livraison enregistrée pour cette date.\n\n`;
    }

    report += "=".repeat(50) + "\n";
    report += `Généré le ${new Date().toLocaleString("fr-FR")}\n`;

    // Display in console
    console.log(report);

    // Save to file
    const reportsDir = path.join(__dirname, "..", "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `report-${targetDate}.txt`);
    fs.writeFileSync(reportFile, report, "utf8");
    console.log(`💾 Rapport sauvegardé: ${reportFile}\n`);

    return { report, stats, deliveries, filePath: reportFile };

  } catch (error) {
    console.error("❌ Erreur lors de la génération du rapport:", error.message);
    throw error;
  }
}

// Helper to get deliveries by date (for historical reports)
async function getDeliveriesByDate(date) {
  const { adapter } = require("./db");
  const config = require("./config");

  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      `SELECT * FROM deliveries 
      WHERE created_at::date = $1
      ORDER BY created_at DESC`,
      [date]
    );
  } else {
    return await adapter.query(
      `SELECT * FROM deliveries 
      WHERE DATE(created_at) = DATE(?)
      ORDER BY created_at DESC`,
      [date]
    );
  }
}

// If called directly from command line
if (require.main === module) {
  const { close } = require("./db");
  const args = process.argv.slice(2);
  const dateArg = args.find(arg => arg.startsWith('--date='));
  const date = dateArg ? dateArg.split('=')[1] : null;

  generateDailyReport(date)
    .then(async () => {
      console.log("✅ Rapport généré avec succès\n");
      await close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("❌ Erreur:", error.message);
      await close();
      process.exit(1);
    });
}

module.exports = { generateDailyReport };

