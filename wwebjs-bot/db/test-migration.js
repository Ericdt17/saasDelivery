#!/usr/bin/env node

/**
 * Test Migration System
 * Simple test to verify migrations work correctly
 */

const { runMigrations } = require('./migrate');
const config = require('../src/config');

async function testMigrations() {
  console.log('\n🧪 Testing Migration System\n');
  console.log('='.repeat(50));
  
  try {
    // Test migration run
    console.log('\n1️⃣ Testing migration execution...');
    await runMigrations();
    
    console.log('\n2️⃣ Testing idempotency (running again)...');
    await runMigrations();
    
    console.log('\n✅ All tests passed!');
    console.log('='.repeat(50));
    console.log('\nMigration system is working correctly! 🎉\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testMigrations();
}

module.exports = { testMigrations };


