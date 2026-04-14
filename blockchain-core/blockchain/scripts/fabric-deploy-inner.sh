#!/bin/bash
# Run inside the Fabric CLI container context via: docker exec -i cli bash -s < fabric-deploy-inner.sh
# Or from repo: Get-Content fabric-deploy-inner.sh -Raw | docker exec -i cli bash -s
set -e

CHANNEL_NAME="trustledger-channel"
CC_NAME="trustledger"
PEER_ROOT="/opt/gopath/src/github.com/hyperledger/fabric/peer"
ORDERER_CA="$PEER_ROOT/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem"
PEER0_TLS="$PEER_ROOT/crypto/peerOrganizations/sacco.trustledger.com/peers/peer0.sacco.trustledger.com/tls/ca.crt"
PEER1_TLS="$PEER_ROOT/crypto/peerOrganizations/sacco.trustledger.com/peers/peer1.sacco.trustledger.com/tls/ca.crt"

cd "$PEER_ROOT"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.sacco.trustledger.com:7051

if peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME" 2>/dev/null | grep -q "Version:"; then
  echo "[fabric-deploy] Chaincode '$CC_NAME' is already committed on '$CHANNEL_NAME'. Nothing to do."
  exit 0
fi

if ! peer channel list 2>/dev/null | grep -q "${CHANNEL_NAME}"; then
  echo "[fabric-deploy] Creating channel ${CHANNEL_NAME}..."
  peer channel create \
    -o orderer.trustledger.com:7050 \
    -c "$CHANNEL_NAME" \
    -f ./channel-artifacts/trustledger-channel.tx \
    --tls --cafile "$ORDERER_CA"
  peer channel join -b "${CHANNEL_NAME}.block"
  CORE_PEER_ADDRESS=peer1.sacco.trustledger.com:9051 peer channel join -b "${CHANNEL_NAME}.block"
  if [ -f ./channel-artifacts/SaccoOrgMSPanchors.tx ]; then
    peer channel update \
      -o orderer.trustledger.com:7050 \
      -c "$CHANNEL_NAME" \
      -f ./channel-artifacts/SaccoOrgMSPanchors.tx \
      --tls --cafile "$ORDERER_CA"
  else
    echo "[fabric-deploy] Note: SaccoOrgMSPanchors.tx not found - skipped anchor update (OK for local dev)."
  fi
else
  echo "[fabric-deploy] Channel $CHANNEL_NAME already present on peer0."
fi

export CORE_PEER_ADDRESS=peer0.sacco.trustledger.com:7051
cd "$PEER_ROOT"

echo "[fabric-deploy] Packaging & installing chaincode..."
peer lifecycle chaincode package "${CC_NAME}.tar.gz" \
  --path ./chaincode --lang node --label "${CC_NAME}_1.0"

peer lifecycle chaincode install "${CC_NAME}.tar.gz"
CORE_PEER_ADDRESS=peer1.sacco.trustledger.com:9051 peer lifecycle chaincode install "${CC_NAME}.tar.gz"

CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | sed -n 's/.*Package ID: //;s/, Label:.*//p' | head -1 | tr -d '\r')
if [ -z "$CC_PACKAGE_ID" ]; then
  echo "[fabric-deploy] ERROR: Could not read chaincode package ID from queryinstalled."
  exit 1
fi
echo "[fabric-deploy] Package ID: $CC_PACKAGE_ID"

echo "[fabric-deploy] Approving for org..."
peer lifecycle chaincode approveformyorg \
  -o orderer.trustledger.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CC_NAME" \
  --version 1.0 \
  --package-id "$CC_PACKAGE_ID" \
  --sequence 1 \
  --tls \
  --cafile "$ORDERER_CA"

echo "[fabric-deploy] Committing definition (peer0 + peer1)..."
peer lifecycle chaincode commit \
  -o orderer.trustledger.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CC_NAME" \
  --version 1.0 \
  --sequence 1 \
  --tls \
  --cafile "$ORDERER_CA" \
  --peerAddresses peer0.sacco.trustledger.com:7051 \
  --tlsRootCertFiles "$PEER0_TLS" \
  --peerAddresses peer1.sacco.trustledger.com:9051 \
  --tlsRootCertFiles "$PEER1_TLS"

echo "[fabric-deploy] Committed chaincode:"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME"
echo "[fabric-deploy] Done."
