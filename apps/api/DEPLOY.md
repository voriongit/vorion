# Vorion API Backend - VPS Deployment Guide

Deploy the Vorion API backend to any VPS (DigitalOcean, Linode, Vultr, Hetzner, AWS EC2, etc.)

## Prerequisites

- Ubuntu 22.04+ server (or Debian 11+)
- Domain name pointed to your server IP (optional, for SSL)
- SSH access to server

## Quick Start (5 minutes)

### Step 1: Create a VPS

**DigitalOcean** (recommended for beginners):
1. Go to [digitalocean.com](https://digitalocean.com)
2. Create Droplet → Ubuntu 22.04 → Basic → $6/month (1GB RAM)
3. Add SSH key or use password
4. Note your server IP

**Other providers**: Linode, Vultr, Hetzner - similar process, any $5-10/month VPS works.

### Step 2: SSH into your server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 3: Run setup script

```bash
# Download and run setup
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/apps/api/deploy/setup.sh | bash
```

Or manually:
```bash
# Update & install Node.js 20
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Install PM2
npm install -g pm2
```

### Step 4: Clone and install

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/Axiom.git /opt/vorion
cd /opt/vorion

# Make scripts executable
chmod +x apps/api/deploy/*.sh

# Install
./apps/api/deploy/install.sh
```

### Step 5: Start the API

```bash
./apps/api/deploy/start.sh
```

You'll see output like:
```
VORION_API_URL=http://YOUR_SERVER_IP:4000
VORION_API_KEY=abc123...your-key...xyz789
```

**Save these values!**

### Step 6: Test it works

```bash
curl http://localhost:4000/health
# Should return: {"status":"healthy",...}
```

### Step 7: Connect Dashboard

Add to Vercel Environment Variables (Dashboard > Settings > Environment Variables):

| Variable | Value |
|----------|-------|
| `VORION_API_URL` | `http://YOUR_SERVER_IP:4000` |
| `VORION_API_KEY` | `your-api-key-from-step-5` |

Redeploy your Vercel dashboard to apply.

---

## Add SSL (Recommended)

For HTTPS with automatic SSL certificates:

### Option A: Use Caddy (easiest)

```bash
# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Configure (replace with your domain)
./apps/api/deploy/caddy.sh api.yourdomain.com
```

### Option B: Use Cloudflare Tunnel (no open ports needed)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create vorion-api
cloudflared tunnel route dns vorion-api api.yourdomain.com

# Run tunnel
cloudflared tunnel run --url http://localhost:4000 vorion-api
```

---

## Firewall Setup

```bash
# Allow SSH and API port
ufw allow 22
ufw allow 4000   # Remove this if using Caddy/Cloudflare
ufw allow 80     # For Caddy SSL verification
ufw allow 443    # For HTTPS
ufw enable
```

---

## Useful Commands

```bash
# View logs
pm2 logs vorion-api

# Restart API
pm2 restart vorion-api

# Stop API
pm2 stop vorion-api

# Update code
cd /opt/vorion
git pull
./apps/api/deploy/install.sh
pm2 restart vorion-api
```

---

## Troubleshooting

### API not responding
```bash
# Check if running
pm2 status

# Check logs
pm2 logs vorion-api --lines 50

# Check port
netstat -tlnp | grep 4000
```

### Agent commands failing
```bash
# Check packages are built
ls /opt/vorion/packages/sentinel/dist/

# Rebuild if needed
cd /opt/vorion/packages/sentinel
npm run build
```

### Permission denied
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/vorion
```

---

## Cost

| Provider | Specs | Price |
|----------|-------|-------|
| DigitalOcean | 1GB RAM, 1 CPU | $6/month |
| Linode | 1GB RAM, 1 CPU | $5/month |
| Vultr | 1GB RAM, 1 CPU | $5/month |
| Hetzner | 2GB RAM, 1 CPU | €4/month |
| AWS EC2 | t3.micro (free tier) | Free for 12 months |

The API is lightweight - even the smallest VPS works fine.
