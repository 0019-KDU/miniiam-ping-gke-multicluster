#!/bin/bash
###############################################################################
# Ping IAM Lab - VM Deployment Script
# VM IP: 143.198.224.95
###############################################################################

set -e

echo "========================================="
echo "  Ping IAM Lab - VM Deployment"
echo "  Target: 143.198.224.95"
echo "========================================="

# Update system
echo "[1/6] Updating system..."
sudo apt-get update -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "[2/6] Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "[2/6] Docker already installed"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "[3/6] Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "[3/6] Docker Compose already installed"
fi

# Create project directory
echo "[4/6] Setting up project directory..."
mkdir -p ~/ping-iam-lab
cd ~/ping-iam-lab

# Open firewall ports
echo "[5/6] Configuring firewall..."
sudo ufw allow 1389/tcp  # LDAP
sudo ufw allow 1636/tcp  # LDAPS
sudo ufw allow 1443/tcp  # PD Console
sudo ufw allow 9999/tcp  # PF Admin
sudo ufw allow 9031/tcp  # PF Runtime
sudo ufw allow 9000/tcp  # PA Admin
sudo ufw allow 3000/tcp  # PA Runtime
sudo ufw allow 3443/tcp  # PA Runtime HTTPS
sudo ufw allow 5173/tcp  # React App
sudo ufw allow 8080/tcp  # Backend API

echo "[6/6] Ready for deployment!"
echo ""
echo "========================================="
echo "  Next Steps:"
echo "========================================="
echo "1. Copy ping-iam-lab folder to VM:"
echo "   scp -r ping-iam-lab/ user@143.198.224.95:~/"
echo ""
echo "2. SSH to VM and start:"
echo "   ssh user@143.198.224.95"
echo "   cd ~/ping-iam-lab"
echo "   docker-compose up -d"
echo ""
echo "3. Access URLs:"
echo "   PingFederate Admin: https://143.198.224.95:9999/pingfederate/app"
echo "   PingAccess Admin:   https://143.198.224.95:9000"
echo "   React App (via PA): http://143.198.224.95:3000"
echo "   React App (direct): http://143.198.224.95:5173"
echo "========================================="
