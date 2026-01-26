#!/bin/bash
# Vorion API Backend - VPS Setup Script
# Run this on a fresh Ubuntu 22.04+ server

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║     Vorion API Backend - Server Setup          ║"
echo "╚════════════════════════════════════════════════╝"

# Update system
echo "→ Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "→ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
echo "→ Installing PM2 process manager..."
sudo npm install -g pm2

# Install Caddy (simpler than nginx, auto-SSL)
echo "→ Installing Caddy web server..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Create app directory
echo "→ Creating application directory..."
sudo mkdir -p /opt/vorion
sudo chown $USER:$USER /opt/vorion

# Install Git
sudo apt install -y git

echo ""
echo "✓ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Clone your repo: git clone <your-repo> /opt/vorion"
echo "  2. Run: cd /opt/vorion && ./apps/api/deploy/install.sh"
echo ""
