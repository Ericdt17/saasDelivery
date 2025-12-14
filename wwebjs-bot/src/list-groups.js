/**
 * List all WhatsApp groups the bot has access to
 * Helps find the correct Group ID
 */

const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.WHATSAPP_SESSION_PATH || "./auth-dev",
  }),
});

client.on("ready", async () => {
  console.log("\n" + "=".repeat(70));
  console.log("📋 LISTING ALL WHATSAPP GROUPS");
  console.log("=".repeat(70) + "\n");

  try {
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    if (groups.length === 0) {
      console.log("❌ No groups found. Make sure the bot is added to at least one group.\n");
    } else {
      console.log(`✅ Found ${groups.length} group(s):\n`);

      groups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name || 'Unnamed Group'}`);
        console.log(`   📱 Group ID: ${group.id._serialized}`);
        console.log(`   👥 Participants: ${group.participants?.length || 'N/A'}`);
        console.log(`   📊 Unread: ${group.unreadCount || 0} messages`);
        console.log("");
      });

      console.log("=".repeat(70));
      console.log("💡 Copy the Group ID and add it to your .env file:");
      console.log(`   GROUP_ID=120363123456789012@g.us`);
      console.log("=".repeat(70) + "\n");
    }
  } catch (error) {
    console.error("❌ Error listing groups:", error.message);
  }

  await client.destroy();
  process.exit(0);
});

client.on("qr", (qr) => {
  console.log("\n⚠️  QR code required. Please scan with your phone.\n");
  const qrcode = require("qrcode-terminal");
  qrcode.generate(qr, { small: true });
  console.log("\n⏳ Waiting for QR scan... (Press Ctrl+C to cancel)\n");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
  process.exit(1);
});

console.log("🔍 Connecting to WhatsApp to list groups...\n");
client.initialize();

