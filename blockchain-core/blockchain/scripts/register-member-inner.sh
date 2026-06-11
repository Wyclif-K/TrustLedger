#!/bin/bash
# Register a member on the Fabric ledger only (SavingsContract:registerMember).
# Usage inside cli container or: docker exec cli bash /tmp/register-member-inner.sh MEM001 "Full Name" "+256..." "NIN" member
set -euo pipefail

MEMBER_ID="${1:?memberId required}"
FULL_NAME="${2:?fullName required}"
PHONE="${3:?phone required}"
NATIONAL_ID="${4:?nationalId required}"
ROLE="${5:-member}"

PEER_ROOT="/opt/gopath/src/github.com/hyperledger/fabric/peer"
ORDERER_CA="$PEER_ROOT/crypto/ordererOrganizations/trustledger.com/orderers/orderer.trustledger.com/msp/tlscacerts/tlsca.trustledger.com-cert.pem"
PEER0_TLS="$PEER_ROOT/crypto/peerOrganizations/sacco.trustledger.com/peers/peer0.sacco.trustledger.com/tls/ca.crt"

CTOR=$(cat <<EOF
{"function":"SavingsContract:registerMember","Args":["$MEMBER_ID","$FULL_NAME","$PHONE","$NATIONAL_ID","$ROLE"]}
EOF
)

peer chaincode invoke \
  -o orderer.trustledger.com:7050 \
  --tls --cafile "$ORDERER_CA" \
  -C trustledger-channel -n trustledger \
  --peerAddresses peer0.sacco.trustledger.com:7051 \
  --tlsRootCertFiles "$PEER0_TLS" \
  -c "$CTOR" \
  --waitForEvent

echo "Registered $MEMBER_ID on ledger."
