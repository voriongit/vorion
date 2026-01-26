#!/bin/bash
# Vorion API Backend - Start with PM2
# Run from monorepo root: ./apps/api/deploy/start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"

echo "╔════════════════════════════════════════════════╗"
echo "║     Vorion API Backend - Starting              ║"
echo "╚════════════════════════════════════════════════╝"

cd "$API_DIR"

# Load environment
source .env 2>/dev/null || true

# Stop existing if running
pm2 delete vorion-api 2>/dev/null || true

# Start with PM2
pm2 start dist/index.js \
    --name "vorion-api" \
    --cwd "$API_DIR" \
    --env production \
    --max-memory-restart 500M \
    --log-date-format "YYYY-MM-DD HH:mm:ss"

# Save PM2 config for startup
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "✓ Vorion API started!"
echo ""
pm2 status
echo ""
echo "Commands:"
echo "  pm2 logs vorion-api    # View logs"
echo "  pm2 restart vorion-api # Restart"
echo "  pm2 stop vorion-api    # Stop"
echo ""

# Show API key for dashboard config
if [ -f .env ]; then
    API_KEY=$(grep API_KEY .env | cut -d= -f2)
    echo "╔════════════════════════════════════════════════╗"
    echo "║  Add these to Vercel Environment Variables:   ║"
    echo "╠════════════════════════════════════════════════╣"
    echo "  VORION_API_URL=http://YOUR_SERVER_IP:4000"
    echo "  VORION_API_KEY=$API_KEY"
    echo "╚════════════════════════════════════════════════╝"
fi
