#!/usr/bin/env node

/**
 * Production Startup Script
 * Runs migrations before starting the API server
 * Used by PM2 on VPS
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting production server with migrations...\n');

// Step 1: Run migrations
console.log('📋 Step 1: Running database migrations...');
const migrateProcess = spawn('npm', ['run', 'migrate:prod'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '../..'),
});

migrateProcess.on('close', (migrateCode) => {
  if (migrateCode !== 0) {
    console.error('\n❌ Migrations failed. Server will not start.');
    console.error('💡 Fix migration errors before starting the server.');
    process.exit(1);
  }

  console.log('\n✅ Migrations completed successfully\n');

  // Step 2: Start the API server
  console.log('🚀 Step 2: Starting API server...\n');
  const serverProcess = spawn('node', ['src/api/server.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '../..'),
  });

  serverProcess.on('close', (serverCode) => {
    console.log(`\n⚠️  Server exited with code ${serverCode}`);
    process.exit(serverCode);
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
  });
});

migrateProcess.on('error', (error) => {
  console.error('❌ Failed to run migrations:', error.message);
  process.exit(1);
});

