#!/bin/bash
# Vorion API Backend - Installation Script
# Run from monorepo root: ./apps/api/deploy/install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"

echo "╔════════════════════════════════════════════════╗"
echo "║     Vorion API Backend - Installation          ║"
echo "╚════════════════════════════════════════════════╝"
echo "Root: $ROOT_DIR"
echo "API:  $API_DIR"

# Generate secure API key if not exists
if [ ! -f "$API_DIR/.env" ]; then
    API_KEY=$(openssl rand -hex 32)
    echo "→ Generating .env with secure API key..."
    cat > "$API_DIR/.env" << EOF
PORT=4000
HOST=127.0.0.1
API_KEY=$API_KEY
ROOT_DIR=$ROOT_DIR
NODE_ENV=production
EOF
    echo "✓ Generated API key: ${API_KEY:0:16}..."
else
    echo "→ Using existing .env file"
fi

# Install API dependencies
echo "→ Installing API dependencies..."
cd "$API_DIR"
npm install --production=false

# Build API
echo "→ Building API..."
npm run build

# Build agent packages
echo "→ Building agent packages..."
cd "$ROOT_DIR"

for pkg in sentinel herald scribe curator watchman librarian envoy ts-fixer council; do
    if [ -d "packages/$pkg" ] && [ -f "packages/$pkg/package.json" ]; then
        echo "  Building $pkg..."
        cd "packages/$pkg"
        npm install --production=false 2>/dev/null || true
        npm run build 2>/dev/null || true
        cd "$ROOT_DIR"
    fi
done

echo ""
echo "✓ Installation complete!"
echo ""
echo "Next: Run ./apps/api/deploy/start.sh to start the server"
echo ""
