#!/usr/bin/env node

/**
 * Production Migration Script
 * Runs migrations with extra safety checks for production
 */

const { runMigrations } = require('../../db/migrate');

// Safety checks
function validateProductionEnvironment() {
  // Check if we're in production
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: NODE_ENV is not "production"');
    console.warn('   This script is intended for production use only.');
    console.warn('   Use "npm run migrate" for development.\n');
  }

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set');
    console.error('   Production migrations require DATABASE_URL environment variable.');
    console.error('   Set it in your .env.prod file or environment.\n');
    process.exit(1);
  }

  // Warn if database URL looks like dev
  const dbUrl = process.env.DATABASE_URL.toLowerCase();
  if (dbUrl.includes('dev') || dbUrl.includes('development')) {
    console.warn('⚠️  WARNING: DATABASE_URL contains "dev" or "development"');
    console.warn('   Are you sure this is the production database?\n');
  }

  console.log('✅ Production environment validated\n');
}

// Main execution
async function main() {
  try {
    console.log('🔒 Production Migration Script');
    console.log('='.repeat(60) + '\n');

    // Run safety checks
    validateProductionEnvironment();

    // Run migrations
    console.log('🔄 Running migrations...\n');
    await runMigrations();

    console.log('\n✅ Production migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Production migration failed:', error.message);
    console.error('\n💡 Action required:');
    console.error('   1. Check the error message above');
    console.error('   2. Verify DATABASE_URL is correct');
    console.error('   3. Check database connectivity');
    console.error('   4. Fix issues before restarting the server\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };

