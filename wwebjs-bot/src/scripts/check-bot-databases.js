#!/usr/bin/env node
/**
 * Script to check which database each bot instance is connected to
 * Checks both local bot and production bot configurations
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");

console.log("\n" + "=".repeat(70));
console.log("🔍 BOT DATABASE CONNECTION CHECKER");
console.log("=".repeat(70));

// Check local bot configuration
console.log("\n📱 BOT 1: LOCAL BOT (Your Machine)");
console.log("-".repeat(70));

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const dbType = process.env.DB_TYPE || "sqlite";
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "bot.db");
const nodeEnv = process.env.NODE_ENV || "development";

// Check auth directory
const authPath = process.env.WHATSAPP_SESSION_PATH || "./auth-dev";
const authExists = fs.existsSync(path.join(__dirname, "..", "..", authPath));

console.log(`   Environment: ${nodeEnv}`);
console.log(`   Auth Directory: ${authPath} ${authExists ? "✅ (exists)" : "❌ (not found)"}`);

if (hasDatabaseUrl) {
  // PostgreSQL
  try {
    const dbUrl = process.env.DATABASE_URL;
    const url = new URL(dbUrl);
    const host = url.hostname;
    const dbName = url.pathname.replace('/', '');
    const port = url.port || 5432;
    
    console.log(`   🗄️  Database Type: PostgreSQL (Remote)`);
    console.log(`   📍 Host: ${host}`);
    console.log(`   🗃️  Database: ${dbName}`);
    console.log(`   🔌 Port: ${port}`);
    console.log(`   ⚠️  Status: Using remote PostgreSQL database`);
  } catch (e) {
    console.log(`   🗄️  Database Type: PostgreSQL (Remote)`);
    console.log(`   ⚠️  Status: DATABASE_URL set but could not parse`);
  }
} else {
  // SQLite
  const fullPath = path.resolve(__dirname, "..", "..", dbPath);
  const dbExists = fs.existsSync(fullPath);
  
  console.log(`   🗄️  Database Type: SQLite (Local)`);
  console.log(`   📁 Path: ${fullPath}`);
  console.log(`   ${dbExists ? "✅" : "⚠️"} Database file ${dbExists ? "exists" : "does not exist yet"}`);
  
  if (dbExists) {
    try {
      const stats = fs.statSync(fullPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   📊 Size: ${sizeMB} MB`);
    } catch (e) {
      // Ignore
    }
  }
}

// Check production bot (Render) - based on documentation
console.log("\n📱 BOT 2: PRODUCTION BOT (Render)");
console.log("-".repeat(70));

console.log(`   Environment: production (on Render)`);
console.log(`   🗄️  Database Type: PostgreSQL (Remote)`);
console.log(`   📍 Host: Render PostgreSQL Database`);
console.log(`   ⚠️  Note: This is inferred from render.yaml configuration`);
console.log(`   💡 To verify, check Render dashboard logs`);

// Summary
console.log("\n" + "=".repeat(70));
console.log("📊 SUMMARY");
console.log("=".repeat(70));

if (hasDatabaseUrl) {
  console.log("\n⚠️  WARNING: Local bot is using REMOTE PostgreSQL database");
  console.log("   This means:");
  console.log("   - Local bot requires internet connection");
  console.log("   - Local bot shares database with production (if same DB)");
  console.log("   - Slower performance than local SQLite");
  console.log("\n💡 Recommendation: Comment out DATABASE_URL to use local SQLite");
} else {
  console.log("\n✅ Local bot is using LOCAL SQLite database");
  console.log("   This means:");
  console.log("   - Works offline");
  console.log("   - Fast performance");
  console.log("   - Completely isolated from production");
}

console.log("\n✅ Production bot uses PostgreSQL (on Render)");
console.log("   - Remote database");
console.log("   - Shared with other services");

console.log("\n" + "=".repeat(70));
console.log("💡 TIP: Restart your server to see the database banner on startup");
console.log("=".repeat(70) + "\n");











