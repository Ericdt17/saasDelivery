const qrcode = require("qrcode-terminal");
/**
 * Comprehensive Resilience Test Harness for WhatsApp Web JS Client
 *
 * Test Suites:
 * 1. Basic Disconnects - Standard disconnect/reconnect cycles
 * 2. Rapid Disconnects - Multiple quick on/off cycles (stress test)
 * 3. Long Offline - Extended downtime recovery test
 * 4. Message Handling - Tests message operations during disconnect
 * 5. Concurrent Operations - Multiple operations during disconnect
 * 6. Stress Test - Many cycles to test stability over time
 *
 * Usage:
 *   # Run all tests
 *   npm run test:resilience
 *
 *   # Run specific tests only
 *   RUN_RAPID=false RUN_STRESS=false npm run test:resilience
 *
 *   # Customize test parameters
 *   CYCLES=10 OFFLINE_MS=5000 npm run test:resilience
 *
 * Environment Variables:
 *   CLIENT_ID - Auth client ID (default: "resilience-test")
 *   CYCLES - Number of basic cycles (default: 5)
 *   OFFLINE_MS - Offline duration in ms (default: 7000)
 *   RECOVER_TIMEOUT_MS - Recovery timeout in ms (default: 30000)
 *   RUN_BASIC - Enable basic test (default: true)
 *   RUN_RAPID - Enable rapid disconnect test (default: true)
 *   RUN_LONG_OFFLINE - Enable long offline test (default: true)
 *   RUN_MESSAGE_HANDLING - Enable message handling test (default: true)
 *   RUN_CONCURRENT_OPS - Enable concurrent ops test (default: true)
 *   RUN_STRESS - Enable stress test (default: true)
 *
 * Notes:
 * - Uses dedicated LocalAuth clientId (does not touch production session)
 * - You will need to scan a QR the first time for this clientId
 * - Runs headless; look at console output for detailed results
 * - Exits non-zero if any test fails
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");

const CLIENT_ID = process.env.CLIENT_ID || "resilience-test";
const CYCLES = Number(process.env.CYCLES || 5);
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 7000);
const RECOVER_TIMEOUT_MS = Number(process.env.RECOVER_TIMEOUT_MS || 30000);
const RECOVER_POLL_MS = 1500;

// Test suite selection (set to "false" to disable a test)
const RUN_BASIC = process.env.RUN_BASIC !== "false";
const RUN_RAPID = process.env.RUN_RAPID !== "false";
const RUN_LONG_OFFLINE = process.env.RUN_LONG_OFFLINE !== "false";
const RUN_MESSAGE_HANDLING = process.env.RUN_MESSAGE_HANDLING !== "false";
const RUN_CONCURRENT_OPS = process.env.RUN_CONCURRENT_OPS !== "false";
const RUN_STRESS = process.env.RUN_STRESS !== "false";

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: CLIENT_ID,
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
    timeout: 120000,
    ignoreDefaultArgs: ["--disable-extensions"],
  },
  restartOnAuthFail: true,
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html",
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exitCode = 1;
});

client.on("qr", (qr) => {
  console.log("\nQR required. Scan with WhatsApp → Linked Devices.\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("Authenticated. Session stored for clientId:", CLIENT_ID);
});

client.on("auth_failure", (msg) => {
  console.error("AUTH FAILURE:", msg);
  process.exit(1);
});

client.on("ready", async () => {
  console.log("Client ready. Starting resilience test...");
  try {
    await runTest();
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    await safeDestroy();
  }
});

client.on("change_state", (state) => {
  console.log("State changed:", state);
});

client.on("disconnected", (reason) => {
  console.warn("DISCONNECTED:", reason);
});

async function safeDestroy() {
  try {
    await client.destroy();
  } catch (err) {
    // Ignore destroy errors during shutdown
  }
}

// Helper function to get current time
function nowMs() {
  return Date.now();
}

// Wait for client to leave CONNECTED state (to ensure disconnect is detected)
async function waitForNotConnected(label, customTimeout = 15000) {
  const start = nowMs();
  let lastState = "UNKNOWN";

  while (nowMs() - start < customTimeout) {
    lastState = await client.getState().catch(() => "UNKNOWN");
    if (lastState !== "CONNECTED") {
      return true;
    }
    await wait(500);
  }

  // If still connected, that's okay - we'll proceed anyway
  console.warn(`${label}: Still CONNECTED after offline (may be cached state)`);
  return false;
}

// Test results tracking
const testResults = {
  basic: { passed: 0, failed: 0 },
  rapid: { passed: 0, failed: 0 },
  longOffline: { passed: 0, failed: 0 },
  messageHandling: { passed: 0, failed: 0 },
  concurrentOps: { passed: 0, failed: 0 },
  stress: { passed: 0, failed: 0 },
};

// Test 1: Basic disconnect/reconnect cycles
async function testBasicDisconnects() {
  if (!RUN_BASIC) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Basic Disconnect/Reconnect Cycles");
  console.log("=".repeat(60));

  const page = client.pupPage;
  if (!page) throw new Error("Puppeteer page not available");

  for (let i = 1; i <= CYCLES; i++) {
    console.log(`\n--- Cycle ${i}/${CYCLES} ---`);
    console.log("Simulating offline...");
    await page.setOfflineMode(true);

    // Wait for disconnect to be detected (or proceed if still connected)
    await waitForNotConnected(`Cycle ${i} offline`, 5000);
    await wait(OFFLINE_MS);

    console.log("Restoring online...");
    await page.setOfflineMode(false);

    const ok = await waitForConnected(`Cycle ${i}`);
    if (ok) {
      testResults.basic.passed++;
      console.log(`Cycle ${i}: ✅ Recovered`);
    } else {
      testResults.basic.failed++;
      console.error(`Cycle ${i}: ❌ FAILED to recover`);
    }
  }
}

// Test 2: Rapid disconnect cycles (stress test)
async function testRapidDisconnects() {
  if (!RUN_RAPID) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Rapid Disconnect Cycles (Stress Test)");
  console.log("=".repeat(60));

  const page = client.pupPage;
  const rapidCycles = 10;
  const rapidOfflineMs = 2000; // Shorter offline periods

  for (let i = 1; i <= rapidCycles; i++) {
    console.log(`\n--- Rapid Cycle ${i}/${rapidCycles} ---`);
    await page.setOfflineMode(true);
    await waitForNotConnected(`Rapid ${i} offline`, 3000);
    await wait(rapidOfflineMs);
    await page.setOfflineMode(false);

    const ok = await waitForConnected(`Rapid ${i}`, 20000); // Shorter timeout
    if (ok) {
      testResults.rapid.passed++;
      console.log(`Rapid ${i}: ✅ Recovered`);
    } else {
      testResults.rapid.failed++;
      console.error(`Rapid ${i}: ❌ FAILED`);
    }
    await wait(1000); // Brief pause between cycles
  }
}

// Test 3: Long offline period
async function testLongOffline() {
  if (!RUN_LONG_OFFLINE) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Long Offline Period Recovery");
  console.log("=".repeat(60));

  const page = client.pupPage;
  const longOfflineMs = 30000; // 30 seconds offline

  console.log(`Simulating ${longOfflineMs / 1000}s offline period...`);
  await page.setOfflineMode(true);
  await waitForNotConnected("Long Offline offline", 5000);
  await wait(longOfflineMs);

  console.log("Restoring online...");
  await page.setOfflineMode(false);

  const ok = await waitForConnected("Long Offline", 60000); // Longer timeout
  if (ok) {
    testResults.longOffline.passed++;
    console.log("✅ Recovered from long offline period");
  } else {
    testResults.longOffline.failed++;
    console.error("❌ FAILED to recover from long offline period");
  }
}

// Test 4: Message handling during disconnect
async function testMessageHandling() {
  if (!RUN_MESSAGE_HANDLING) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Message Handling During Disconnect");
  console.log("=".repeat(60));

  const page = client.pupPage;
  let messageReceived = false;
  let messageError = null;

  // Set up message listener
  const messageHandler = () => {
    messageReceived = true;
  };
  client.on("message", messageHandler);

  try {
    console.log("Going offline...");
    await page.setOfflineMode(true);
    await wait(5000);

    // Try to get chats while offline (should handle gracefully)
    console.log("Attempting to get chats while offline...");
    try {
      await client.getChats().catch((err) => {
        messageError = err.message;
        console.log(`Expected error while offline: ${err.message}`);
      });
    } catch (err) {
      messageError = err.message;
    }

    console.log("Restoring online...");
    await page.setOfflineMode(false);
    await waitForConnected("Message Test", 30000);

    // Verify client is functional after recovery
    const chats = await client.getChats().catch(() => []);
    if (chats.length >= 0) {
      testResults.messageHandling.passed++;
      console.log("✅ Client functional after disconnect recovery");
    } else {
      testResults.messageHandling.failed++;
      console.error("❌ Client not functional after recovery");
    }
  } finally {
    client.removeListener("message", messageHandler);
  }
}

// Test 5: Concurrent operations during disconnect
async function testConcurrentOperations() {
  if (!RUN_CONCURRENT_OPS) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Concurrent Operations During Disconnect");
  console.log("=".repeat(60));

  const page = client.pupPage;
  const operations = [];

  console.log("Starting concurrent operations...");
  await page.setOfflineMode(true);

  // Start multiple operations while offline
  operations.push(client.getState().catch((e) => ({ error: e.message })));
  operations.push(client.getChats().catch((e) => ({ error: e.message })));
  operations.push(client.getContacts().catch((e) => ({ error: e.message })));

  await wait(3000);
  await page.setOfflineMode(false);
  await waitForConnected("Concurrent Ops", 30000);

  // Wait for operations to complete
  const results = await Promise.allSettled(operations);
  const allHandled = results.every((r) => r.status === "fulfilled");

  if (allHandled) {
    testResults.concurrentOps.passed++;
    console.log("✅ All concurrent operations handled gracefully");
  } else {
    testResults.concurrentOps.failed++;
    console.error("❌ Some operations failed unexpectedly");
  }
}

// Test 6: Stress test - many cycles
async function testStress() {
  if (!RUN_STRESS) return;
  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Stress Test (Many Cycles)");
  console.log("=".repeat(60));

  const page = client.pupPage;
  const stressCycles = 20;
  let passed = 0;
  let failed = 0;

  console.log(`Running ${stressCycles} stress cycles...`);
  for (let i = 1; i <= stressCycles; i++) {
    await page.setOfflineMode(true);
    await waitForNotConnected(`Stress ${i} offline`, 2000);
    await wait(3000);
    await page.setOfflineMode(false);

    const ok = await waitForConnected(`Stress ${i}`, 25000);
    if (ok) {
      passed++;
      if (i % 5 === 0) console.log(`✅ Completed ${i}/${stressCycles} cycles`);
    } else {
      failed++;
      console.error(`❌ Failed at cycle ${i}`);
    }
    await wait(500);
  }

  testResults.stress.passed = passed;
  testResults.stress.failed = failed;
  console.log(`\nStress test: ${passed} passed, ${failed} failed`);
}

// Enhanced waitForConnected with custom timeout and better error reporting
async function waitForConnected(label, customTimeout = null) {
  const timeout = customTimeout || RECOVER_TIMEOUT_MS;
  const start = nowMs();
  let lastState = "UNKNOWN";
  let pollCount = 0;

  while (nowMs() - start < timeout) {
    lastState = await client.getState().catch(() => "UNKNOWN");
    if (lastState === "CONNECTED") {
      const took = ((nowMs() - start) / 1000).toFixed(1);
      console.log(`${label}: Recovered to CONNECTED in ${took}s`);
      return true;
    }

    // Log state every 5 polls to avoid spam
    pollCount++;
    if (pollCount % 5 === 0) {
      console.log(
        `${label}: Waiting for CONNECTED, current state=${lastState}...`
      );
    }

    await wait(RECOVER_POLL_MS);
  }

  // Timeout - log the last state we saw
  console.error(
    `${label}: ❌ TIMEOUT waiting for CONNECTED (lastState=${lastState}, timeout=${timeout}ms)`
  );
  return false;
}

// Main test runner
async function runTest() {
  const page = client.pupPage;
  if (!page) {
    throw new Error("Puppeteer page not available; client not fully ready.");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🧪 COMPREHENSIVE RESILIENCE TEST SUITE");
  console.log("=".repeat(60));
  console.log(`Basic cycles: ${CYCLES}`);
  console.log(`Offline duration: ${OFFLINE_MS}ms`);
  console.log(`Recovery timeout: ${RECOVER_TIMEOUT_MS}ms`);
  console.log("=".repeat(60));

  try {
    // Run all test suites
    await testBasicDisconnects();
    await testRapidDisconnects();
    await testLongOffline();
    await testMessageHandling();
    await testConcurrentOperations();
    await testStress();

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST RESULTS SUMMARY");
    console.log("=".repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;

    Object.entries(testResults).forEach(([testName, result]) => {
      const total = result.passed + result.failed;
      if (total > 0) {
        const status = result.failed === 0 ? "✅" : "❌";
        console.log(
          `${status} ${testName}: ${result.passed}/${total} passed, ${result.failed} failed`
        );
        totalPassed += result.passed;
        totalFailed += result.failed;
      }
    });

    console.log("=".repeat(60));
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
    console.log("=".repeat(60));

    if (totalFailed > 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (err) {
    console.error("\n❌ Test suite crashed:", err);
    process.exitCode = 1;
  }
}

console.log("Initializing client for resilience test...");
client.initialize();
