/**
 * Generate and send daily report as WhatsApp message
 * Usage: npm run report:send
 *        npm run report:send -- --date=2024-12-08
 *        npm run report:send -- --group=GROUP_ID
 *        npm run report:send -- --phone=612345678
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const { generateDailyReport } = require("./daily-report");
const config = require("./config");
const { close } = require("./db");

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    // Parse arguments
    const dateArg = args.find((arg) => arg.startsWith("--date="));
    const groupArg = args.find((arg) => arg.startsWith("--group="));
    const phoneArg = args.find((arg) => arg.startsWith("--phone="));

    const date = dateArg ? dateArg.split("=")[1] : null;
    const targetGroup = groupArg ? groupArg.split("=")[1] : null;
    const targetPhone = phoneArg ? phoneArg.split("=")[1] : null;

    console.log("\n📊 Generating daily report...");
    console.log("   Date:", date || "today");

    try {
      // Generate the report
      const { report } = await generateDailyReport(date);

      console.log("\n📤 Sending report via WhatsApp...");

      // Initialize WhatsApp client
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: process.env.CLIENT_ID || "delivery-bot-default",
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
          ],
        },
      });

      client.on("ready", async () => {
        console.log("✅ WhatsApp client ready");

        try {
          let chat;
          let recipientInfo = "";

          // Determine recipient: explicit > phone > group > config
          if (targetGroup) {
            let groupId = targetGroup;
            if (!groupId.includes("@")) {
              groupId = `${groupId}@g.us`;
            }
            console.log(`   Sending to group: ${groupId}`);
            chat = await client.getChatById(groupId);
            recipientInfo = `Group: "${chat.name || groupId}"`;
          } else if (targetPhone) {
            const chatId = `${targetPhone.replace(/\D/g, "")}@c.us`;
            console.log(`   Sending to phone: ${targetPhone}`);
            chat = await client.getChatById(chatId);
            recipientInfo = `Phone: ${targetPhone}`;
          } else if (config.REPORT_RECIPIENT) {
            const chatId = `${config.REPORT_RECIPIENT.replace(/\D/g, "")}@c.us`;
            console.log(
              `   Sending to configured recipient: ${config.REPORT_RECIPIENT}`
            );
            chat = await client.getChatById(chatId);
            recipientInfo = `Phone: ${config.REPORT_RECIPIENT}`;
          } else if (config.GROUP_ID) {
            let groupId = config.GROUP_ID;
            if (!groupId.includes("@")) {
              groupId = `${groupId}@g.us`;
            }
            console.log(`   Sending to default group: ${groupId}`);
            chat = await client.getChatById(groupId);
            recipientInfo = `Group: "${chat.name || groupId}"`;
          } else {
            console.error("❌ Error: No recipient specified!");
            console.error("\n💡 Options:");
            console.error("   1. Set GROUP_ID or REPORT_RECIPIENT in .env");
            console.error("   2. Use: npm run report:send -- --group=GROUP_ID");
            console.error(
              "   3. Use: npm run report:send -- --phone=612345678"
            );
            await client.destroy();
            await close();
            process.exit(1);
          }

          // Send the report
          console.log(`\n   📨 Sending to: ${recipientInfo}`);
          const sentMessage = await chat.sendMessage(report);

          console.log("   ✅ Report sent successfully!");
          console.log(
            `   📱 Message ID: ${sentMessage.id._serialized || sentMessage.id}`
          );
          console.log(`   ⏰ Sent at: ${new Date().toLocaleString("fr-FR")}`);

          // Verify
          console.log(`\n   🔍 Verifying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          try {
            await chat.sendSeen();
            const messages = await chat.fetchMessages({ limit: 5 });
            const found = messages.find(
              (m) =>
                m.fromMe && m.id?._serialized === sentMessage.id?._serialized
            );
            if (found) {
              console.log(`   ✅ Verified: Report confirmed in chat!`);
            }
          } catch (e) {
            // Ignore verification errors
          }

          await client.destroy();
          await close();
          console.log("\n✅ Done!\n");
          process.exit(0);
        } catch (error) {
          console.error(`\n❌ Error sending report: ${error.message}`);

          if (
            error.message.includes("Target closed") ||
            error.message.includes("Protocol error")
          ) {
            console.error("\n💡 This error usually means:");
            console.error(
              "   1. The main bot is already running (using the same session)"
            );
            console.error("   2. WhatsApp session expired or disconnected");
            console.error(
              "\n🔧 Solution: Stop the main bot first, then try sending the report."
            );
          }

          await client.destroy().catch(() => {});
          await close();
          process.exit(1);
        }
      });

      client.on("qr", (qr) => {
        console.log("\n⚠️  QR code required. Please scan with your phone.");
        console.log(
          "   💡 Tip: Run the main bot first to authenticate, then use this script.\n"
        );

        const qrcode = require("qrcode-terminal");
        qrcode.generate(qr, { small: true });

        console.log("\n⏳ Waiting for QR scan... (Press Ctrl+C to cancel)\n");
      });

      client.on("authenticated", () => {
        console.log("✅ Authenticated! Session saved.\n");
      });

      client.on("auth_failure", (msg) => {
        console.error("❌ Authentication failed:", msg);
        process.exit(1);
      });

      client.on("disconnected", (reason) => {
        console.error("\n❌ WhatsApp client disconnected:", reason);
        process.exit(1);
      });

      client.initialize();
    } catch (error) {
      console.error(`\n❌ Error generating report: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      await close();
      process.exit(1);
    }
  })().catch((error) => {
    console.error("\n❌ Fatal error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = {};
