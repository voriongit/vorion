#!/bin/bash
# Vorion API Backend - Configure Caddy reverse proxy with SSL
# Usage: ./caddy.sh api.yourdomain.com

DOMAIN=${1:-"api.vorion.local"}

echo "╔════════════════════════════════════════════════╗"
echo "║     Vorion API - Caddy SSL Setup               ║"
echo "╚════════════════════════════════════════════════╝"
echo "Domain: $DOMAIN"

# Create Caddyfile
sudo tee /etc/caddy/Caddyfile > /dev/null << EOF
$DOMAIN {
    reverse_proxy localhost:4000

    header {
        # Security headers
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        # CORS - adjust origin as needed
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Authorization, Content-Type"
    }

    log {
        output file /var/log/caddy/vorion-api.log
    }
}
EOF

# Create log directory
sudo mkdir -p /var/log/caddy

# Restart Caddy
sudo systemctl restart caddy

echo ""
echo "✓ Caddy configured!"
echo ""
echo "Your API is now available at: https://$DOMAIN"
echo ""
echo "Update your Vercel environment variables:"
echo "  VORION_API_URL=https://$DOMAIN"
echo ""
