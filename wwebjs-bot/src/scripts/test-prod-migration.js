#!/usr/bin/env node

/**
 * Test Production Migration Script Locally
 * This simulates what will happen on VPS
 */

console.log('🧪 Testing Production Migration Setup\n');
console.log('='.repeat(60) + '\n');

// Test 1: Check if migrate-prod.js exists and can be required
console.log('📋 Test 1: Checking migrate-prod.js script...');
try {
  const migrateProd = require('./migrate-prod');
  console.log('✅ migrate-prod.js can be loaded\n');
} catch (error) {
  console.error('❌ Failed to load migrate-prod.js:', error.message);
  process.exit(1);
}

// Test 2: Check if start-with-migrations.js exists
console.log('📋 Test 2: Checking start-with-migrations.js script...');
try {
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'start-with-migrations.js');
  if (fs.existsSync(scriptPath)) {
    console.log('✅ start-with-migrations.js exists\n');
  } else {
    console.error('❌ start-with-migrations.js not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking script:', error.message);
  process.exit(1);
}

// Test 3: Check if ecosystem.config.js exists
console.log('📋 Test 3: Checking ecosystem.config.js...');
try {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(__dirname, '../../ecosystem.config.js');
  if (fs.existsSync(configPath)) {
    const config = require(configPath);
    if (config.apps && config.apps[0]) {
      console.log('✅ ecosystem.config.js exists and is valid');
      console.log(`   App name: ${config.apps[0].name}`);
      console.log(`   Script: ${config.apps[0].script}\n`);
    } else {
      console.error('❌ ecosystem.config.js is invalid');
      process.exit(1);
    }
  } else {
    console.error('❌ ecosystem.config.js not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking config:', error.message);
  process.exit(1);
}

// Test 4: Check package.json scripts
console.log('📋 Test 4: Checking package.json scripts...');
try {
  const packageJson = require('../../package.json');
  if (packageJson.scripts['migrate:prod']) {
    console.log('✅ migrate:prod script exists in package.json\n');
  } else {
    console.error('❌ migrate:prod script not found in package.json');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking package.json:', error.message);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('✅ All basic tests passed!');
console.log('\n💡 Next: Test migration script with your local database');
console.log('   Run: npm run migrate:prod (will use local.db for testing)');
console.log('   Note: This will show warnings since NODE_ENV is not production\n');

