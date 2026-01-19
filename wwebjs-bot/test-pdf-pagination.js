/**
 * Test Suite for PDF Pagination Logic
 *
 * Goal: verify that the page management logic (ensureSpace + drawFooter)
 * does NOT create empty pages in the middle of the report, and that each
 * page (except possibly the very last) has content before its footer.
 *
 * NOTE: On purpose, this file does NOT depend on PDFKit.
 * It simulates the pagination logic with a virtual "doc" and pages array.
 */

// ---------------- Test Harness Utilities ----------------

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    failures.push(`${message} | Expected: ${expected}, Actual: ${actual}`);
    console.log(`  ❌ ${message}`);
    console.log(`      Expected: ${expected}, Actual: ${actual}`);
  }
}

// ---------------- Simulation of Pagination ----------------

/**
 * Simulates the pagination logic used in reports.js:
 * - pages: array of { rows: number, footers: number }
 * - currentY tracked inside the simulator
 * - SAFE_PAGE_BREAK = 780
 * - rowHeight, resumeHeight etc. are parameters
 */
function simulateReportPagination({
  numRows,
  rowHeight = 15,
  resumeHeight = 142,
  safePageBreak = 780,
}) {
  const pages = [];

  // Start with first page
  pages.push({ rows: 0, footers: 0 });
  let currentPage = 0;
  let currentY = 50; // same as in reports.js

  const drawFooter = () => {
    pages[currentPage].footers += 1;
  };

  const addPage = () => {
    pages.push({ rows: 0, footers: 0 });
    currentPage = pages.length - 1;
    currentY = 50;
  };

  const ensureSpace = (neededHeight) => {
    if (currentY + neededHeight > safePageBreak) {
      // Finish current page
      drawFooter();
      addPage();
    }
  };

  // 1) Simulate table rows (allLivraisonsDetails)
  for (let i = 0; i < numRows; i++) {
    ensureSpace(rowHeight);
    // write row
    pages[currentPage].rows += 1;
    currentY += rowHeight;
  }

  // 2) Simulate "Total encaissé" block (~35 points)
  ensureSpace(35);
  currentY += 35;

  // 3) Simulate tarifs table header + rows (we just model header as 18pt)
  ensureSpace(18);
  currentY += 18;

  // Tarifs rows: assume same number as deliveries for stress test
  for (let i = 0; i < numRows; i++) {
    ensureSpace(rowHeight);
    pages[currentPage].rows += 1;
    currentY += rowHeight;
  }

  // 4) Total tarifs block (~32pt)
  ensureSpace(32);
  currentY += 32;

  // 5) Résumé section
  ensureSpace(resumeHeight);
  currentY += resumeHeight;

  // 6) Final footer for the last page
  drawFooter();

  return pages;
}

// ---------------- Tests ----------------

async function testNoEmptyMiddlePagesSmall() {
  console.log("\nTEST 1: No empty middle pages with 50 rows");

  const pages = simulateReportPagination({ numRows: 50 });

  // Every page except the last must have at least one row
  for (let i = 0; i < pages.length - 1; i++) {
    assert(
      pages[i].rows > 0,
      `Page ${i + 1} should have rows before footer (rows=${pages[i].rows})`
    );
    assertEqual(
      pages[i].footers,
      1,
      `Page ${i + 1} should have exactly one footer`
    );
  }

  // Last page: at least a footer, rows may be 0 or more depending on layout
  const last = pages[pages.length - 1];
  assertEqual(
    last.footers,
    1,
    `Last page should have exactly one footer`
  );
}

async function testNoEmptyMiddlePagesLarge() {
  console.log("\nTEST 2: No empty middle pages with 500 rows (stress test)");

  const pages = simulateReportPagination({ numRows: 500 });

  for (let i = 0; i < pages.length - 1; i++) {
    assert(
      pages[i].rows > 0,
      `Page ${i + 1} should have rows before footer (rows=${pages[i].rows})`
    );
    assertEqual(
      pages[i].footers,
      1,
      `Page ${i + 1} should have exactly one footer`
    );
  }

  const last = pages[pages.length - 1];
  assertEqual(
    last.footers,
    1,
    `Last page should have exactly one footer`
  );
}

async function testFooterOnlyOnPageEnd() {
  console.log("\nTEST 3: Footer only added when page is finished");

  const pages = simulateReportPagination({ numRows: 100 });

  // For every page, footer count must be 1 and must appear after at least
  // one call to ensureSpace-triggered page break OR at finalization.
  pages.forEach((page, index) => {
    assertEqual(
      page.footers,
      1,
      `Page ${index + 1} should have exactly one footer`
    );
  });
}

// ---------------- Runner ----------------

async function runTests() {
  console.log("\n🧪 Starting PDF pagination tests...\n");

  try {
    await testNoEmptyMiddlePagesSmall();
    await testNoEmptyMiddlePagesLarge();
    await testFooterOnlyOnPageEnd();
  } catch (err) {
    console.error("❌ Error while running pagination tests:", err);
    testsFailed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Pagination Test Summary");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total:  ${testsPassed + testsFailed}`);

  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    failures.forEach((f) => console.log("  - " + f));
  }

  console.log("");
  process.exit(testsFailed > 0 ? 1 : 0);
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error("Fatal error in pagination tests:", err);
    process.exit(1);
  });
}

module.exports = {
  simulateReportPagination,
};

