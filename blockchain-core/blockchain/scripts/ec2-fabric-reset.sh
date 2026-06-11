#!/bin/bash
# =============================================================================
# TrustLedger — wipe Fabric ledger state on EC2 and bring network back up empty.
# Keeps crypto + channel artifacts from git; removes Docker volumes (all members,
# savings, loans, transactions on chain).
#
# Usage (on EC2 as ec2-user):
#   bash ec2-fabric-reset.sh
# =============================================================================
set -euo pipefail

REPO_DIR="${TRUSTLEDGER_REPO_DIR:-$HOME/TrustLedger}"
NETWORK_DIR="$REPO_DIR/blockchain-core/blockchain/network"
BOOTSTRAP="$REPO_DIR/blockchain-core/blockchain/scripts/ec2-fabric-bootstrap.sh"

log() { echo "[ec2-reset] $*"; }

compose() {
  if sudo docker compose version >/dev/null 2>&1; then
    sudo docker compose -f "$NETWORK_DIR/docker-compose.yaml" "$@"
  else
    sudo docker-compose -f "$NETWORK_DIR/docker-compose.yaml" "$@"
  fi
}

if [ ! -f "$NETWORK_DIR/docker-compose.yaml" ]; then
  echo "Missing $NETWORK_DIR/docker-compose.yaml — clone TrustLedger first." >&2
  exit 1
fi

log "Stopping Fabric and removing ledger volumes (all on-chain data will be erased)..."
compose down -v --remove-orphans 2>/dev/null || true

log "Removing chaincode runtime images..."
sudo docker rmi $(sudo docker images "dev-peer*" -q) 2>/dev/null || true

log "Re-bootstrap: start network, create channel, deploy chaincode..."
if [ -f "$BOOTSTRAP" ]; then
  bash "$BOOTSTRAP"
elif [ -f /tmp/ec2-fabric-bootstrap.sh ]; then
  bash /tmp/ec2-fabric-bootstrap.sh
else
  echo "Missing ec2-fabric-bootstrap.sh in repo or /tmp" >&2
  exit 1
fi

log "Reset complete. Ledger is empty — register members on blockchain before deposits."
log "PostgreSQL (Railway) user records are unchanged; re-register each memberId on the ledger."
