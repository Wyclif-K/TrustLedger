# TrustLedger — Phase 4: USSD Bridge Service

> Node.js · Express · Redis · Africa's Talking · Docker

---

## What's Included in Phase 4

```
ussd-service/
├── .env.example
├── package.json
├── Dockerfile
├── docker-compose.yaml
├── scripts/
│   ├── tunnel.sh          ← ngrok tunnel for local AT sandbox testing
│   └── simulate.js        ← Interactive CLI USSD simulator (no handset needed)
├── src/
│   ├── server.js          ← Entry point — starts HTTP server + Redis + SMS
│   ├── app.js             ← Express app (routes, middleware, health check)
│   ├── config/
│   │   ├── index.js       ← Env var loader
│   │   └── logger.js      ← Winston logger
│   ├── services/
│   │   ├── session.service.js   ← Redis session store (fallback to in-memory)
│   │   ├── backend.service.js   ← HTTP client to Phase 2 backend API
│   │   └── sms.service.js       ← Africa's Talking SMS confirmations
│   ├── handlers/
│   │   ├── router.js            ← Master session engine + flow router
│   │   ├── balance.handler.js   ← Option 1: Balance check
│   │   ├── statement.handler.js ← Option 2: Mini-statement
│   │   ├── loanstatus.handler.js← Option 3: Loan status
│   │   ├── loanapply.handler.js ← Option 4: 4-step loan application flow
│   │   └── repayment.handler.js ← Option 5: 2-step repayment flow
│   ├── middleware/
│   │   └── index.js       ← IP whitelist, payload validator, error handler
│   └── utils/
│       └── response.builder.js ← CON/END builder, all pre-built screens
└── tests/
    └── ussd.test.js       ← 30+ tests (all flows, validation, response builder)
```

---

## How It Fits Into TrustLedger

```
Feature Phone → dials *234# → Carrier Network
        ↓
Africa's Talking USSD Gateway
        ↓  POST (sessionId, phoneNumber, text)
USSD Bridge (this service) — port 4000
        ↓  HTTP + X-Service-Key
Phase 2 Backend API — port 3000
        ↓
Hyperledger Fabric Blockchain
        ↓
Result flows back up the chain as a CON/END text response
```

The USSD service **never touches the blockchain directly**. All data goes through the Phase 2 backend API using a service-to-service API key. This keeps the architecture clean and the blockchain gateway in one place.

---

## USSD Menu (*234#)

```
TrustLedger SACCO
1. Check Balance
2. Mini Statement
3. Loan Status
4. Apply for Loan
5. Make Repayment
0. Exit
```

### Option 1 — Check Balance
Single step. Returns savings balance and outstanding loan if any. Sends SMS confirmation.

### Option 2 — Mini Statement
Single step. Returns last 5 transactions formatted for small screens.

### Option 3 — Loan Status
Single step. Returns active loan status, outstanding balance, and next due date.

### Option 4 — Apply for Loan (4 steps)

```
User: 4
  ← Enter loan amount (UGX):
User: 1000000
  ← Choose repayment period: 1.3mo 2.6mo 3.12mo 4.24mo
User: 3
  ← Enter purpose:
User: School fees
  ← Confirm Loan: Amt UGX 1M | Term 12mo | Monthly UGX 91K | Total UGX 1.09M
    1. Confirm  2. Cancel
User: 1
  ← END Loan application submitted! Ref: LOAN-MEM001-xxx
```

Blocks if member already has an active loan. Validates amount against policy (min UGX 100K, max UGX 50M). Shows real monthly instalment and total repayable from the loan policy.

### Option 5 — Make Repayment (2 steps)

```
User: 5
  ← Outstanding: UGX 820,000 | Monthly: UGX 91,000
    Enter amount (UGX):
User: 91000
  ← Confirm Payment: Amt UGX 91K | Loan xxx | Bal after: UGX 729K
    1. Confirm  2. Cancel
User: 1
  ← END Payment confirmed! Amt UGX 91K | Ref: USSD-1712345678
```

---

## Quick Start

### Option A — Run directly

```bash
cd trustledger/ussd-service

# Install
npm install

# Configure
cp .env.example .env
# Edit .env — set BACKEND_API_URL to your Phase 2 backend

# Start Redis (required for sessions)
docker run -d -p 6379:6379 --name ussd-redis redis:7-alpine

# Run in dev mode
npm run dev
# → http://localhost:4000
```

### Option B — Docker Compose

```bash
cd trustledger/ussd-service

cp .env.example .env
# Edit .env

docker-compose up -d

# Check logs
docker-compose logs -f ussd-service
```

---

## Test Without a Handset

### Interactive CLI Simulator

```bash
# Start the service first
npm run dev

# In another terminal, run the simulator
node scripts/simulate.js

# With a specific phone number
node scripts/simulate.js --phone=+256700999999
```

The simulator renders a phone-screen-like box in your terminal and walks through the full USSD flow interactively.

### Run Automated Tests

```bash
npm test
```

Tests use fully mocked Redis, backend API, and SMS — no live services needed. Covers all menu flows, edge cases, and the response builder.

---

## Connect to Africa's Talking Sandbox

Africa's Talking requires a publicly reachable URL. Use the tunnel helper:

```bash
# Requires ngrok (npm install -g ngrok) with auth configured
chmod +x scripts/tunnel.sh
./scripts/tunnel.sh
```

The script:
1. Starts the USSD service (if not already running)
2. Opens an ngrok HTTPS tunnel
3. Prints the webhook URL to paste into the AT sandbox
4. Runs a local smoke test automatically

### Manual AT Sandbox Setup

1. Go to [account.africastalking.com](https://account.africastalking.com/apps/sandbox)
2. Click **USSD → Create Channel**
3. Set shortcode to `*234#` (or any shortcode)
4. Set callback URL to `https://your-ngrok-id.ngrok.io/ussd`
5. In `.env` set `AT_USERNAME=sandbox` and `AT_API_KEY=<your-sandbox-key>`
6. Use the AT simulator on their dashboard or SMS the shortcode from the AT sandbox phone

---

## Production Deployment

### Environment variables to set in production

| Variable | Description |
|----------|-------------|
| `AT_USERNAME` | Your AT production username (not sandbox) |
| `AT_API_KEY` | Your AT production API key |
| `BACKEND_API_URL` | Internal URL of the Phase 2 backend |
| `BACKEND_API_KEY` | Service-to-service auth key (set same value in backend) |
| `REDIS_URL` | Redis connection string |
| `WHITELIST_ENABLED` | Set to `true` to restrict to AT gateway IPs |
| `AT_GATEWAY_IPS` | Comma-separated list of AT gateway IP addresses |

### AT Gateway IP Whitelist

Africa's Talking publishes their gateway IPs. Set in `.env`:

```env
WHITELIST_ENABLED=true
AT_GATEWAY_IPS=196.201.214.200,196.201.214.201,196.201.214.202,196.201.214.203
```

---

## Session Architecture

USSD sessions are stateless at the carrier level — every request in a multi-step flow is a separate HTTP POST. The session engine:

1. Reads the `sessionId` from Africa's Talking (consistent per dial)
2. Loads the session from Redis (member ID, current flow, current step, accumulated data)
3. Processes the new input
4. Writes the updated session back to Redis with a refreshed TTL (120s)
5. Returns a `CON` or `END` response

Redis uses an `allkeys-lru` eviction policy so it self-manages memory under load.

**In-memory fallback**: If Redis is unreachable (dev/test), the service automatically falls back to an in-memory Map. This means sessions are not shared across multiple instances — acceptable in dev, use Redis in production.

---

## Next: Phase 5 — Android App (Kotlin + Jetpack Compose)

The mobile app connects to the same Phase 2 backend API and provides:
- Login with JWT (biometric unlock on Android)
- Real-time savings balance from the blockchain
- Deposit initiation
- Loan application (equivalent to the USSD flow, but with a full UI)
- Repayment via mobile money integration
- Push notifications for loan status changes
