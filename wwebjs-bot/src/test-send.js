/**
 * Test script to verify message sending works
 * Sends a simple test message and verifies it appears
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: process.env.CLIENT_ID || "delivery-bot-default",
  }),
});

client.on("ready", async () => {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TESTING MESSAGE SENDING");
  console.log("=".repeat(70) + "\n");

  if (!config.GROUP_ID) {
    console.error("❌ No GROUP_ID configured in .env");
    console.error("   Please set GROUP_ID in your .env file");
    await client.destroy();
    process.exit(1);
  }

  let groupId = config.GROUP_ID;
  if (!groupId.includes('@')) {
    groupId = `${groupId}@g.us`;
  }

  try {
    console.log(`📋 Testing with group: ${groupId}\n`);
    
    const chat = await client.getChatById(groupId);
    console.log(`✅ Found group: "${chat.name}"`);
    console.log(`📊 Participants: ${chat.participants?.length || 'N/A'}`);
    
    // Get bot info
    const botInfo = client.info;
    const botNumber = botInfo?.wid?.user || 'Unknown';
    console.log(`📱 Bot's WhatsApp number: +${botNumber}`);
    
    // Send test message
    const testMessage = `🧪 TEST MESSAGE - ${new Date().toLocaleTimeString("fr-FR")}`;
    console.log(`\n📤 Sending test message...`);
    console.log(`   Message: "${testMessage}"`);
    
    const sent = await chat.sendMessage(testMessage);
    
    console.log(`\n✅ Message sent!`);
    console.log(`   Message ID: ${sent.id?._serialized || 'N/A'}`);
    
    // Wait and verify
    console.log(`\n⏳ Waiting 5 seconds to verify...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if message appears
    const messages = await chat.fetchMessages({ limit: 5 });
    const found = messages.find(m => m.fromMe && m.body?.includes("TEST MESSAGE"));
    
    if (found) {
      console.log(`\n✅✅✅ SUCCESS! ✅✅✅`);
      console.log(`   Message is confirmed in the group!`);
      console.log(`   📝 Content: "${found.body}"`);
      console.log(`\n💡 To see the message:`);
      console.log(`   1. Open WhatsApp on your phone or desktop`);
      console.log(`   2. Go to group: "${chat.name}"`);
      console.log(`   3. Look for message from: +${botNumber}`);
      console.log(`   4. Message should say: "${testMessage}"`);
    } else {
      console.log(`\n⚠️  Message sent but not immediately visible in history`);
      console.log(`   This might be a sync delay. Check WhatsApp manually.`);
    }
    
    console.log(`\n` + "=".repeat(70));
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(`\n💡 Troubleshooting:`);
    console.error(`   1. Make sure GROUP_ID is correct in .env`);
    console.error(`   2. Verify bot (${botNumber}) is in the group`);
    console.error(`   3. Check group permissions`);
  }
  
  await client.destroy();
  process.exit(0);
});

client.on("qr", (qr) => {
  console.log("\n⚠️  QR code required");
  const qrcode = require("qrcode-terminal");
  qrcode.generate(qr, { small: true });
});

client.on("auth_failure", (msg) => {
  console.error("❌ Auth failed:", msg);
  process.exit(1);
});

console.log("🔍 Initializing WhatsApp client...\n");
client.initialize();

