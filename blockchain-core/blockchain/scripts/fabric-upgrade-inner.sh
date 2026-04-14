#!/bin/bash
# Upgrade committed chaincode to a new sequence (same channel). Run via fabric-upgrade.ps1
set -e

CHANNEL_NAME="trustledger-channel"
CC_NAME="trustledger"
VERSION="1.0"
PEER_ROOT="/opt/gopath/src/github.com/hyperledger/fabric/peer"
ORDERER_CA="$PEER_ROOT/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem"
PEER0_TLS="$PEER_ROOT/crypto/peerOrganizations/sacco.trustledger.com/peers/peer0.sacco.trustledger.com/tls/ca.crt"
PEER1_TLS="$PEER_ROOT/crypto/peerOrganizations/sacco.trustledger.com/peers/peer1.sacco.trustledger.com/tls/ca.crt"

cd "$PEER_ROOT"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.sacco.trustledger.com:7051

COMMITTED=$(peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME" 2>/dev/null || true)
SEQ=$(echo "$COMMITTED" | sed -n 's/.*Sequence: \([0-9][0-9]*\).*/\1/p' | head -1)
if [ -z "$SEQ" ]; then
  echo "[fabric-upgrade] No committed chaincode '$CC_NAME' on '$CHANNEL_NAME'. Run: npm run fabric:deploy"
  exit 1
fi

NEXT=$((SEQ + 1))
LABEL="${CC_NAME}_seq${NEXT}"
echo "[fabric-upgrade] Bumping sequence $SEQ -> $NEXT (package label: $LABEL)"

peer lifecycle chaincode package "${CC_NAME}.tar.gz" \
  --path ./chaincode --lang node --label "$LABEL"

peer lifecycle chaincode install "${CC_NAME}.tar.gz"
CORE_PEER_ADDRESS=peer1.sacco.trustledger.com:9051 peer lifecycle chaincode install "${CC_NAME}.tar.gz"

CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | sed -n 's/.*Package ID: //;s/, Label:.*//p' | grep "$LABEL" | head -1 | tr -d '\r')
if [ -z "$CC_PACKAGE_ID" ]; then
  echo "[fabric-upgrade] Could not find package ID for label $LABEL; using newest trustledger line"
  CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep 'trustledger' | sed -n 's/.*Package ID: //;s/, Label:.*//p' | tail -1 | tr -d '\r')
fi
if [ -z "$CC_PACKAGE_ID" ]; then
  echo "[fabric-upgrade] ERROR: Could not resolve package ID."
  exit 1
fi
echo "[fabric-upgrade] Package ID: $CC_PACKAGE_ID"

peer lifecycle chaincode approveformyorg \
  -o orderer.trustledger.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CC_NAME" \
  --version "$VERSION" \
  --package-id "$CC_PACKAGE_ID" \
  --sequence "$NEXT" \
  --tls \
  --cafile "$ORDERER_CA"

peer lifecycle chaincode commit \
  -o orderer.trustledger.com:7050 \
  --channelID "$CHANNEL_NAME" \
  --name "$CC_NAME" \
  --version "$VERSION" \
  --sequence "$NEXT" \
  --tls \
  --cafile "$ORDERER_CA" \
  --peerAddresses peer0.sacco.trustledger.com:7051 \
  --tlsRootCertFiles "$PEER0_TLS" \
  --peerAddresses peer1.sacco.trustledger.com:9051 \
  --tlsRootCertFiles "$PEER1_TLS"

echo "[fabric-upgrade] Committed definition:"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME"
echo "[fabric-upgrade] Done."
