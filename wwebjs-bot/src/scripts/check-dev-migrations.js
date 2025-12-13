/**
 * Check if schema_migrations table exists in dev database
 * Run this to verify migrations ran on Render
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkMigrationsTable() {
  // Get DATABASE_URL from environment (your dev DB on Render)
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set in environment');
    console.log('💡 Set DATABASE_URL to your dev database connection string');
    process.exit(1);
  }

  console.log('🔍 Connecting to database...');
  console.log(`   Database: ${databaseUrl.split('@')[1] || 'hidden'}\n`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if schema_migrations table exists
    console.log('📋 Checking for schema_migrations table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;

    if (!tableExists) {
      console.log('❌ schema_migrations table does NOT exist');
      console.log('💡 Migrations may not have run, or table was not created');
      process.exit(1);
    }

    console.log('✅ schema_migrations table EXISTS\n');

    // Get applied migrations
    console.log('📊 Checking applied migrations...');
    const migrations = await pool.query(`
      SELECT version, applied_at 
      FROM schema_migrations 
      ORDER BY version;
    `);

    if (migrations.rows.length === 0) {
      console.log('⚠️  Table exists but no migrations recorded');
      console.log('💡 This means migrations ran but none were applied');
    } else {
      console.log(`✅ Found ${migrations.rows.length} applied migration(s):\n`);
      migrations.rows.forEach((migration, index) => {
        console.log(`   ${index + 1}. ${migration.version}`);
        console.log(`      Applied: ${migration.applied_at}\n`);
      });
    }

    // Check other tables
    console.log('📋 Checking other tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`✅ Found ${tables.rows.length} table(s) in database:\n`);
    tables.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });

    console.log('\n✅ Database schema looks good!');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkMigrationsTable();

