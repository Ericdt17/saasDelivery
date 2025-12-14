#!/bin/bash
# Script to check and fix ALLOWED_ORIGINS

echo "=== Checking current ALLOWED_ORIGINS ==="
echo ""

# Check PM2 environment
echo "1. PM2 environment variables:"
pm2 env api | grep ALLOWED_ORIGINS || echo "   Not found in PM2 env"

echo ""
echo "2. Checking common .env file locations:"
if [ -f ~/.env ]; then
    echo "   ~/.env:"
    grep ALLOWED_ORIGINS ~/.env || echo "   Not found"
fi

if [ -f /opt/saasDelivery/wwebjs-bot/.env ]; then
    echo "   /opt/saasDelivery/wwebjs-bot/.env:"
    grep ALLOWED_ORIGINS /opt/saasDelivery/wwebjs-bot/.env || echo "   Not found"
fi

if [ -f /opt/saasDelivery/.env ]; then
    echo "   /opt/saasDelivery/.env:"
    grep ALLOWED_ORIGINS /opt/saasDelivery/.env || echo "   Not found"
fi

echo ""
echo "3. PM2 process info:"
pm2 show api | grep -E "exec cwd|script path" || echo "   Could not find process info"

echo ""
echo "=== To fix, run these commands ==="
echo ""
echo "# Option 1: If using .env file, edit it:"
echo "nano ~/.env"
echo "# Add or update:"
echo "ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238"
echo ""
echo "# Option 2: Set via PM2:"
echo "pm2 set ALLOWED_ORIGINS 'http://157.173.118.238,https://157.173.118.238'"
echo ""
echo "# Then restart:"
echo "pm2 restart api"



