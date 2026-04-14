#!/bin/bash
# =============================================================================
# TrustLedger USSD Service - Local Testing Helper
#
# Africa's Talking requires a publicly reachable URL to send USSD webhooks.
# This script starts ngrok and registers the tunnel URL with your AT sandbox.
#
# Prerequisites:
#   npm install -g ngrok
#   ngrok config add-authtoken <your-token>  (from https://ngrok.com)
#
# Usage:
#   chmod +x scripts/tunnel.sh
#   ./scripts/tunnel.sh
# =============================================================================

set -e

PORT=${PORT:-4000}
AT_USERNAME=${AT_USERNAME:-sandbox}
AT_API_KEY=${AT_API_KEY:-}
AT_SHORTCODE=${AT_SHORTCODE:-*234#}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Check ngrok is installed ──────────────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  log_error "ngrok not found. Install it: npm install -g ngrok"
  exit 1
fi

# ── Start USSD service in background if not running ───────────────────────────
if ! curl -s http://localhost:$PORT/health &>/dev/null; then
  log_info "Starting USSD service on port $PORT..."
  npm run dev &
  sleep 3
fi

log_ok "USSD service is running on port $PORT"

# ── Start ngrok tunnel ────────────────────────────────────────────────────────
log_info "Starting ngrok tunnel..."
ngrok http $PORT --log=stdout &
NGROK_PID=$!
sleep 3

# ── Get the public URL from ngrok API ─────────────────────────────────────────
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels \
  | grep -o '"public_url":"https://[^"]*"' \
  | head -1 \
  | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
  log_error "Could not retrieve ngrok URL. Check ngrok is running."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

WEBHOOK_URL="${NGROK_URL}/ussd"

log_ok "ngrok tunnel active: ${NGROK_URL}"
log_ok "USSD webhook URL:    ${WEBHOOK_URL}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Africa's Talking Sandbox Configuration"
echo "═══════════════════════════════════════════════════════"
echo "  Go to: https://account.africastalking.com/apps/sandbox"
echo "  → USSD → Create Channel"
echo "  → Shortcode: ${AT_SHORTCODE}"
echo "  → Callback URL: ${WEBHOOK_URL}"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Test the webhook endpoint ─────────────────────────────────────────────────
log_info "Testing USSD endpoint locally..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:$PORT/ussd \
  -d "sessionId=test-sess-001" \
  -d "serviceCode=${AT_SHORTCODE}" \
  -d "phoneNumber=+256700123456" \
  -d "text=" \
  -d "networkCode=63902")

echo "Test response: ${TEST_RESPONSE}"

if echo "$TEST_RESPONSE" | grep -q "CON"; then
  log_ok "Endpoint is working correctly."
else
  log_warn "Unexpected response. Check your service logs."
fi

echo ""
log_info "Press Ctrl+C to stop ngrok and the service."

# ── Cleanup on exit ───────────────────────────────────────────────────────────
trap "kill $NGROK_PID 2>/dev/null; log_info 'Tunnel closed.'" EXIT

wait $NGROK_PID
