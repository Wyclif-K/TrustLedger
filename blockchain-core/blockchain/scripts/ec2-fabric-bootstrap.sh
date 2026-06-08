#!/bin/bash
# =============================================================================
# TrustLedger — bootstrap Hyperledger Fabric on a fresh Amazon Linux EC2 host.
# Uses crypto + channel artifacts already in the repo (no cryptogen on host).
#
# Usage (on EC2 as ec2-user):
#   bash ec2-fabric-bootstrap.sh
# =============================================================================
set -euo pipefail

REPO_URL="${TRUSTLEDGER_REPO_URL:-https://github.com/Wyclif-K/TrustLedger.git}"
REPO_DIR="${TRUSTLEDGER_REPO_DIR:-$HOME/TrustLedger}"
NETWORK_DIR="$REPO_DIR/blockchain-core/blockchain/network"
SCRIPTS_DIR="$REPO_DIR/blockchain-core/blockchain/scripts"

log() { echo "[ec2-bootstrap] $*"; }

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker and Git..."
  sudo dnf install -y docker git
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER" || true
fi

if ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Compose plugin..."
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  COMPOSE_VER="${DOCKER_COMPOSE_VERSION:-v2.24.5}"
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    sudo docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    sudo docker-compose "$@"
  else
    echo "docker compose not available" >&2
    exit 1
  fi
}

if [ -d "$REPO_DIR/.git" ]; then
  log "Updating repo at $REPO_DIR"
  git -C "$REPO_DIR" pull --ff-only
else
  log "Cloning $REPO_URL -> $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

COMPOSE_FILE="$NETWORK_DIR/docker-compose.yaml"
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing $COMPOSE_FILE" >&2
  exit 1
fi

# Reset compose file so repeated runs do not stack sed replacements (2.5.15.15...).
git -C "$REPO_DIR" checkout -- blockchain-core/blockchain/network/docker-compose.yaml

# Docker 20+ on Linux: mount host socket at /var/run/docker.sock (not /host/...).
sed -i 's|/var/run/docker.sock:/host/var/run/docker.sock|/var/run/docker.sock:/var/run/docker.sock|g' "$COMPOSE_FILE"
sed -i 's|unix:///host/var/run/docker.sock|unix:///var/run/docker.sock|g' "$COMPOSE_FILE"

# Fabric 2.5.15 avoids chaincode install failures on newer Docker engines.
sed -i 's|hyperledger/fabric-peer:2.5$|hyperledger/fabric-peer:2.5.15|g' "$COMPOSE_FILE"
sed -i 's|hyperledger/fabric-orderer:2.5$|hyperledger/fabric-orderer:2.5.15|g' "$COMPOSE_FILE"
sed -i 's|hyperledger/fabric-tools:2.5$|hyperledger/fabric-tools:2.5.15|g' "$COMPOSE_FILE"

log "Pulling chaincode builder image (required for Node chaincode install)..."
sudo docker pull hyperledger/fabric-nodeenv:2.5

log "Starting Fabric containers..."
cd "$NETWORK_DIR"
compose pull
compose up -d

log "Waiting for peers to start..."
sleep 25
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

log "Creating channel and deploying chaincode (if needed)..."
sudo docker cp "$SCRIPTS_DIR/fabric-deploy-inner.sh" cli:/tmp/fabric-deploy-inner.sh
sudo docker exec cli bash /tmp/fabric-deploy-inner.sh

log "Committed chaincode:"
sudo docker exec cli peer lifecycle chaincode querycommitted \
  --channelID trustledger-channel --name trustledger || true

log "Done. Ensure AWS security group allows inbound TCP 7051 from Railway."
log "Set Railway FABRIC_PEER_ENDPOINT=YOUR_PUBLIC_IP:7051"
