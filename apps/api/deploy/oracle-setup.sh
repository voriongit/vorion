#!/bin/bash
# Vorion API - Oracle Cloud Free Tier Setup
# For Ubuntu 22.04 on Oracle Cloud ARM or AMD instance

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   Vorion API - Oracle Cloud Free Tier Setup    ║"
echo "╚════════════════════════════════════════════════╝"

# Oracle uses iptables, need to open port
echo "→ Opening firewall port 4000..."
sudo iptables -I INPUT -p tcp --dport 4000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Update system
echo "→ Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "→ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Install PM2
echo "→ Installing PM2..."
sudo npm install -g pm2

echo ""
echo "✓ Oracle Cloud setup complete!"
echo ""
echo "IMPORTANT: Also open port 4000 in Oracle Cloud Console:"
echo "  1. Go to: Networking → Virtual Cloud Networks"
echo "  2. Click your VCN → Security Lists → Default"
echo "  3. Add Ingress Rule: Source 0.0.0.0/0, Port 4000, TCP"
echo ""
