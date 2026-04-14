#!/bin/bash
# =============================================================================
# TrustLedger - Fabric Network Bootstrap Script
# Run this ONCE to generate all crypto material and channel artifacts,
# then bring the network up.
# =============================================================================

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="${SCRIPT_DIR}/../network"
CHAINCODE_DIR="${SCRIPT_DIR}/../../chaincode"

CHANNEL_NAME="trustledger-channel"
DELAY=3
TIMEOUT=10
VERBOSE=false
CC_NAME="trustledger"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── Prerequisites Check ───────────────────────────────────────────────────
check_prerequisites() {
  log_info "Checking prerequisites..."
  command -v docker >/dev/null 2>&1    || log_error "Docker not found. Install Docker first."
  command -v docker-compose >/dev/null 2>&1 || log_error "docker-compose not found."
  command -v cryptogen >/dev/null 2>&1 || log_error "cryptogen not found. Install Fabric binaries."
  command -v configtxgen >/dev/null 2>&1 || log_error "configtxgen not found. Install Fabric binaries."
  log_ok "All prerequisites found."
}

# ─── Clean Previous Artifacts ──────────────────────────────────────────────
clean_artifacts() {
  log_info "Cleaning previous artifacts..."
  rm -rf "${NETWORK_DIR}/crypto-config" "${NETWORK_DIR}/channel-artifacts"
  mkdir -p "${NETWORK_DIR}/channel-artifacts"
  log_ok "Clean complete."
}

# ─── Generate Crypto Material ─────────────────────────────────────────────
generate_crypto() {
  log_info "Generating crypto material with cryptogen..."
  cryptogen generate --config="${NETWORK_DIR}/crypto-config.yaml" --output="${NETWORK_DIR}/crypto-config"
  log_ok "Crypto material generated in ./crypto-config"
}

# ─── Generate Genesis Block ────────────────────────────────────────────────
generate_genesis() {
  log_info "Generating genesis block..."
  export FABRIC_CFG_PATH="${NETWORK_DIR}"
  configtxgen -profile TrustLedgerGenesis \
    -channelID system-channel \
    -outputBlock "${NETWORK_DIR}/channel-artifacts/genesis.block"
  log_ok "Genesis block created: ./channel-artifacts/genesis.block"
}

# ─── Generate Channel Transaction ─────────────────────────────────────────
generate_channel_tx() {
  log_info "Generating channel transaction for '${CHANNEL_NAME}'..."
  configtxgen -profile TrustLedgerChannel \
    -outputCreateChannelTx "${NETWORK_DIR}/channel-artifacts/trustledger-channel.tx" \
    -channelID $CHANNEL_NAME
  log_ok "Channel tx created: ./channel-artifacts/trustledger-channel.tx"
}

# ─── Generate Anchor Peer Update ──────────────────────────────────────────
generate_anchor_peers() {
  log_info "Generating anchor peer update for SaccoOrg..."
  configtxgen -profile TrustLedgerChannel \
    -outputAnchorPeersUpdate "${NETWORK_DIR}/channel-artifacts/SaccoOrgMSPanchors.tx" \
    -channelID $CHANNEL_NAME \
    -asOrg SaccoOrgMSP
  log_ok "Anchor peer update created."
}

# ─── Start Docker Network ─────────────────────────────────────────────────
start_network() {
  log_info "Starting Fabric Docker network..."
  docker-compose -f "${NETWORK_DIR}/docker-compose.yaml" up -d
  log_info "Waiting ${DELAY}s for containers to start..."
  sleep $DELAY

  # Verify containers are running
  RUNNING=$(docker ps --format "{{.Names}}" | grep -E "peer|orderer|ca" | wc -l)
  log_ok "${RUNNING} containers are running."
}

# ─── Create and Join Channel ──────────────────────────────────────────────
setup_channel() {
  log_info "Creating channel '${CHANNEL_NAME}'..."

  docker exec cli peer channel create \
    -o orderer.trustledger.com:7050 \
    -c $CHANNEL_NAME \
    -f ./channel-artifacts/trustledger-channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem

  log_info "Joining peer0 to channel..."
  docker exec cli peer channel join -b ${CHANNEL_NAME}.block

  log_info "Joining peer1 to channel..."
  docker exec -e "CORE_PEER_ADDRESS=peer1.sacco.trustledger.com:9051" cli peer channel join -b ${CHANNEL_NAME}.block

  log_info "Updating anchor peers..."
  docker exec cli peer channel update \
    -o orderer.trustledger.com:7050 \
    -c $CHANNEL_NAME \
    -f ./channel-artifacts/SaccoOrgMSPanchors.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem

  log_ok "Channel '${CHANNEL_NAME}' is ready. Both peers joined."
}

# ─── Install Chaincode ────────────────────────────────────────────────────
install_chaincode() {
  log_info "Packaging and installing TrustLedger chaincode..."

  log_info "Installing npm dependencies in chaincode (${CHAINCODE_DIR})..."
  ( cd "$CHAINCODE_DIR" && npm install --omit=dev )

  # Package chaincode
  docker exec cli peer lifecycle chaincode package ${CC_NAME}.tar.gz \
    --path ./chaincode \
    --lang node \
    --label ${CC_NAME}_1.0

  # Install on peer0
  docker exec cli peer lifecycle chaincode install ${CC_NAME}.tar.gz

  # Install on peer1
  docker exec -e "CORE_PEER_ADDRESS=peer1.sacco.trustledger.com:9051" \
    cli peer lifecycle chaincode install ${CC_NAME}.tar.gz

  log_info "Getting package ID..."
  CC_PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | sed -n 's/.*Package ID: //;s/, Label:.*//p' | head -1 | tr -d '\r')
  echo "Package ID: ${CC_PACKAGE_ID}"

  log_info "Approving chaincode for SaccoOrg..."
  docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.trustledger.com:7050 \
    --channelID $CHANNEL_NAME \
    --name $CC_NAME \
    --version 1.0 \
    --package-id $CC_PACKAGE_ID \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem

  log_info "Committing chaincode (both peers — required for endorsement)..."
  docker exec cli peer lifecycle chaincode commit \
    -o orderer.trustledger.com:7050 \
    --channelID $CHANNEL_NAME \
    --name $CC_NAME \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem \
    --peerAddresses peer0.sacco.trustledger.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/sacco.trustledger.com/peers/peer0.sacco.trustledger.com/tls/ca.crt \
    --peerAddresses peer1.sacco.trustledger.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/sacco.trustledger.com/peers/peer1.sacco.trustledger.com/tls/ca.crt

  log_ok "Chaincode '${CC_NAME}' deployed successfully!"
}

# ─── Tear Down Network ────────────────────────────────────────────────────
teardown_network() {
  log_warn "Tearing down TrustLedger network..."
  docker-compose -f "${NETWORK_DIR}/docker-compose.yaml" down --volumes --remove-orphans
  docker rmi $(docker images "dev-peer*" -q) 2>/dev/null || true
  rm -rf "${NETWORK_DIR}/crypto-config" "${NETWORK_DIR}/channel-artifacts"
  log_ok "Network torn down and cleaned."
}

# ─── Main ─────────────────────────────────────────────────────────────────
case "$1" in
  up)
    check_prerequisites
    clean_artifacts
    generate_crypto
    generate_genesis
    generate_channel_tx
    generate_anchor_peers
    start_network
    setup_channel
    install_chaincode
    log_ok "===== TrustLedger Fabric Network is UP ====="
    ;;
  down)
    teardown_network
    ;;
  restart)
    teardown_network
    $0 up
    ;;
  channel)
    setup_channel
    ;;
  chaincode)
    install_chaincode
    ;;
  *)
    echo "Usage: $0 {up|down|restart|channel|chaincode}"
    echo ""
    echo "  up         - Generate artifacts, start network, create channel, install chaincode"
    echo "  down       - Stop network and clean all artifacts"
    echo "  restart    - Down then up"
    echo "  channel    - Only create/join the channel (network must be running)"
    echo "  chaincode  - Only install/approve/commit chaincode"
    exit 1
    ;;
esac
