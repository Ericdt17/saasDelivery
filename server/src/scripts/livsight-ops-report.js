/**
 * Usage example: pull last month's revenue + expense reports from
 * LivSight delivery-ops and log the totals.
 *
 * Requires LIVSIGHT_API_BASE_URL and LIVSIGHT_API_KEY in the environment
 * (or server/.env).
 *
 * Run: node src/scripts/livsight-ops-report.js
 */

require("dotenv").config();

const {
  fetchRevenueReport,
  fetchExpenseReport,
  LivsightOpsError,
} = require("../lib/livsightOps");

function lastMonthRange(now = new Date()) {
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 86400000);
  const firstOfPrevMonth = new Date(
    lastOfPrevMonth.getFullYear(),
    lastOfPrevMonth.getMonth(),
    1
  );
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { startDate: iso(firstOfPrevMonth), endDate: iso(lastOfPrevMonth) };
}

const fmtXaf = (n) => `${Number(n).toLocaleString("fr-FR")} F`;

async function main() {
  const { startDate, endDate } = lastMonthRange();
  console.log(`LivSight ops report — ${startDate} → ${endDate}\n`);

  const revenue = await fetchRevenueReport(startDate, endDate);
  console.log("REVENUE");
  console.log(`  Courses facturées : ${revenue.billed_count}`);
  console.log(`  Frais de livraison: ${fmtXaf(revenue.total_delivery_fees)}`);
  console.log(`  Dépenses          : ${fmtXaf(revenue.total_expenses)} (${revenue.expense_count})`);
  console.log(`  Revenu net        : ${fmtXaf(revenue.net_revenue)}\n`);

  const expenses = await fetchExpenseReport(startDate, endDate);
  console.log("EXPENSES");
  console.log(`  Total: ${fmtXaf(expenses.total_amount)} (${expenses.expense_count} lignes)`);
  for (const row of expenses.par_charge_type || []) {
    console.log(`    ${row.charge_type_name}: ${fmtXaf(row.total_amount)} (${row.count})`);
  }
}

main().catch((err) => {
  if (err instanceof LivsightOpsError) {
    console.error(`[${err.code}${err.status ? ` ${err.status}` : ""}] ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
