/**
 * Smoke test: parse a WhatsApp "delivery" message using existing parser,
 * then print a ready-to-run curl command for Core API:
 *   POST http://156.67.27.35:8085/api/transactions (multipart/form-data)
 *
 * This does NOT change bot runtime behavior. It's just a dev helper.
 *
 * Usage:
 *   CORE_API_BASE_URL="http://156.67.27.35:8085" CORE_USER_ID="123" \
 *   CORE_DEPARTURE_CITY="Douala" CORE_DEPARTURE_REGION="Littoral" CORE_DEPARTURE_STREET="Bonapriso Shop" \
 *   CORE_DESTINATION_CITY="Douala" CORE_DESTINATION_REGION="Littoral" \
 *   node src/scripts/smoke-test-core-transaction.js "612345678\n2 robes + 1 sac\n15000\nMakepe"
 *
 * If no message arg is provided, reads from stdin.
 */
const { parseDeliveryMessage } = require("../parser");

function getEnvRequired(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function shQuote(s) {
  // Minimal single-quote escaping for POSIX shells: ' -> '\''.
  const str = String(s ?? "");
  return `'${str.replace(/'/g, `'\"'\"'`)}'`;
}

async function readStdin() {
  return await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function mapParsedToCoreTransaction(parsed, defaults) {
  // Required by Core API (TransactionRequest)
  const receiver_phone = parsed.phone ? String(parsed.phone) : "";
  const package_name = parsed.items ? String(parsed.items).slice(0, 120) : "";
  const description = parsed.items ? String(parsed.items) : "";

  const destination_street =
    parsed.quartier ? String(parsed.quartier) : defaults.destination_street;

  return {
    user_id: defaults.user_id,
    package_name,
    description,
    receiver_name: defaults.receiver_name,
    receiver_phone,
    receiver_gender: defaults.receiver_gender,
    departure_city: defaults.departure_city,
    departure_region: defaults.departure_region,
    departure_street: defaults.departure_street,
    destination_city: defaults.destination_city,
    destination_region: defaults.destination_region,
    destination_street,
    // Optional (if present)
    amount: parsed.amount_due ? Math.trunc(Number(parsed.amount_due)) : undefined,
    quantity: 1,
  };
}

async function main() {
  const argMessage = process.argv.slice(2).join(" ").trim();
  const messageText = argMessage || (await readStdin()).trim();
  if (!messageText) {
    console.error(
      "Provide a message as an argument, or pipe one via stdin."
    );
    process.exit(2);
  }

  const parsed = parseDeliveryMessage(messageText);
  console.log("=== parseDeliveryMessage output ===");
  console.log(JSON.stringify(parsed, null, 2));

  if (!parsed.valid) {
    console.error("\nParse was not valid. Fix the WhatsApp message format first.");
    process.exit(1);
  }

  const coreBaseUrl = getEnvRequired("CORE_API_BASE_URL").replace(/\/+$/, "");
  const defaults = {
    user_id: Number(getEnvRequired("CORE_USER_ID")),
    receiver_name: process.env.CORE_RECEIVER_NAME || "Client",
    receiver_gender: process.env.CORE_RECEIVER_GENDER || "M",
    departure_city: getEnvRequired("CORE_DEPARTURE_CITY"),
    departure_region: getEnvRequired("CORE_DEPARTURE_REGION"),
    departure_street: getEnvRequired("CORE_DEPARTURE_STREET"),
    destination_city: getEnvRequired("CORE_DESTINATION_CITY"),
    destination_region: getEnvRequired("CORE_DESTINATION_REGION"),
    destination_street: process.env.CORE_DESTINATION_STREET || "N/A",
  };

  const payload = mapParsedToCoreTransaction(parsed, defaults);

  // Verify required fields exist (Core API schema requires minLength=1 on many strings)
  const requiredKeys = [
    "user_id",
    "package_name",
    "description",
    "receiver_name",
    "receiver_phone",
    "receiver_gender",
    "departure_city",
    "departure_region",
    "departure_street",
    "destination_city",
    "destination_region",
    "destination_street",
  ];
  const missing = requiredKeys.filter((k) => {
    const v = payload[k];
    if (v === undefined || v === null) return true;
    if (typeof v === "string" && v.trim().length === 0) return true;
    if (k === "user_id" && !Number.isFinite(v)) return true;
    return false;
  });
  if (missing.length) {
    console.error("\nMissing required core fields after mapping:", missing);
    process.exit(1);
  }

  console.log("\n=== Core API payload (fields) ===");
  console.log(JSON.stringify(payload, null, 2));

  const curlParts = [
    "curl -i",
    "-X POST",
    shQuote(`${coreBaseUrl}/api/transactions`),
    ...Object.entries(payload)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `-F ${shQuote(`${k}=${v}`)}`),
  ];

  console.log("\n=== Ready-to-run curl ===");
  console.log(curlParts.join(" \\\n  "));
}

main().catch((err) => {
  console.error("Smoke test failed:", err?.message || err);
  process.exit(1);
});

