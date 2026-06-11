# TrustLedger USSD Setup Guide

**Purpose:** Follow this checklist so members can dial your SACCO shortcode, use the USSD menu (balance, loans, savings), and have requests processed correctly.

**Your shortcode (configured in the Android app):** `*384*13948#`

**Last updated:** June 2026

---

## Table of contents

1. [How USSD works in TrustLedger](#1-how-ussd-works-in-trustledger)
2. [Before you start — requirements](#2-before-you-start--requirements)
3. [Configuration checklist](#3-configuration-checklist)
4. [Local development setup](#4-local-development-setup)
5. [Test without a real phone](#5-test-without-a-real-phone)
6. [Test with Africa's Talking sandbox](#6-test-with-africas-talking-sandbox)
7. [Production deployment (Railway)](#7-production-deployment-railway)
8. [Register members for USSD](#8-register-members-for-ussd)
9. [Admin approval workflow](#9-admin-approval-workflow)
10. [Health checks & monitoring](#10-health-checks--monitoring)
11. [Troubleshooting](#11-troubleshooting)
12. [Quick reference](#12-quick-reference)

---

## 1. How USSD works in TrustLedger

```
Member dials *384*13948#
        ↓
Africa's Talking (or telco gateway)
        ↓  HTTPS POST (sessionId, phoneNumber, text)
USSD Bridge  (port 4000  OR  /ussd-bridge on Railway)
        ↓  HTTP + X-Service-Key header
Backend API  (port 3000  /api/v1)
        ↓
PostgreSQL (member phone lookup, pending requests)
        +
Hyperledger Fabric (balances, loans, transactions)
        ↓
Plain-text response: CON (continue) or END (close session)
```

### USSD menu

| Option | Action | Needs Fabric? | Admin approval? |
|--------|--------|---------------|-----------------|
| 1 | Check balance | Yes | No |
| 2 | Mini statement | Yes | No |
| 3 | Loan status | Yes | No |
| 4 | Apply for loan | Yes | Admin reviews loan later |
| 5 | Make repayment | Yes | **Yes** — pending request queue |
| 6 | Make savings | Yes | **Yes** — pending request queue |
| 0 | Exit | No | No |

> **Note:** Options 5 and 6 do **not** collect mobile money. The member enters an amount; an administrator approves the request in the admin dashboard before it is written to the blockchain.

---

## 2. Before you start — requirements

Check each item before expecting USSD to work end-to-end.

| # | Requirement | Why it matters |
|---|-------------|----------------|
| ☐ | **Node.js 18+** installed | Runs backend and USSD bridge |
| ☐ | **PostgreSQL** running | Member lookup, sessions, pending requests |
| ☐ | **Hyperledger Fabric** running (`FABRIC_ENABLED=true`) | Balance, loans, statements |
| ☐ | **Prisma migrations applied** | Includes `member_requests` table |
| ☐ | **USSD_SERVICE_KEY** set on backend | Enables `/internal/ussd/*` routes |
| ☐ | **BACKEND_API_KEY** set on bridge (same value) | Bridge can call the API |
| ☐ | **Member registered** with phone matching test SIM | USSD identifies users by phone |
| ☐ | **Member on blockchain** (via admin Register) | Balance/loan reads need chain data |
| ☐ | **Public HTTPS URL** (for real phones) | Carriers cannot reach `localhost` |
| ☐ | **Africa's Talking account** + USSD channel | Routes dial-in to your webhook |
| ☐ | **Redis** (recommended in production) | Multi-step flows (loan apply, savings) |

---

## 3. Configuration checklist

### 3.1 Backend (`blockchain-core/backend/.env`)

Copy from `.env.example` if you do not have `.env` yet:

```powershell
cd blockchain-core\backend
copy .env.example .env
```

**Required variables:**

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | `postgresql://trustledger:trustledger@localhost:5432/trustledger` |
| `JWT_SECRET` | Long random string |
| `FABRIC_ENABLED` | `true` for real balances |
| `USSD_SERVICE_KEY` | Random secret — **must match bridge** |

**Generate a shared secret (run once, use same value in both `.env` files):**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Optional but recommended:**

| Variable | Purpose |
|----------|---------|
| `AT_USERNAME` | Africa's Talking username (`sandbox` for testing) |
| `AT_API_KEY` | SMS confirmations after balance check |
| `AT_SHORTCODE` | `*384*13948#` — for dashboard reference |
| `REDIS_URL` | Session store when bridge is embedded on Railway |

### 3.2 USSD bridge (`ussd-bridge/ussd-service/.env`)

```powershell
cd ussd-bridge\ussd-service
copy .env.example .env
```

| Variable | Must equal |
|----------|------------|
| `BACKEND_API_URL` | `http://localhost:3000/api/v1` (local) or `http://127.0.0.1:3000/api/v1` (embedded on Railway) |
| `BACKEND_API_KEY` | **Same value as `USSD_SERVICE_KEY` in backend** |
| `AT_SHORTCODE` | `*384*13948#` |
| `REDIS_URL` | `redis://localhost:6379` (or Railway Redis URL) |

### 3.3 Match these three values

| Setting | Location |
|---------|----------|
| Shortcode in Africa's Talking dashboard | `*384*13948#` |
| `AT_SHORTCODE` in backend `.env` | `*384*13948#` |
| `deposit_ussd_shortcode` in Android app | `*384*13948#` |

### 3.4 Callback URL (Africa's Talking)

| Deployment | Callback URL |
|------------|--------------|
| **Railway (embedded bridge)** | `https://YOUR-APP.up.railway.app/ussd-bridge/ussd` |
| **Standalone bridge + ngrok** | `https://xxxx.ngrok-free.app/ussd` |
| **Legacy (not recommended)** | `https://YOUR-APP.up.railway.app/api/v1/ussd` |

Use the **embedded bridge** URL when deploying with `blockchain-core/Dockerfile` (`USSD_BRIDGE_EMBED=true`).

---

## 4. Local development setup

### Step 1 — Start PostgreSQL

```powershell
cd blockchain-core\backend
npm run db:up
```

Or use your own PostgreSQL instance and set `DATABASE_URL` in `.env`.

### Step 2 — Migrate and seed database

```powershell
cd blockchain-core\backend
npm install
npx prisma migrate deploy
npm run db:seed
```

After seeding you get:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@trustledger.com` | `TrustLedger@Admin2024!` |
| Sample member | `alice@example.com` | `Member@2024!` |
| USSD test phone | `+256700123456` | (use this in simulator) |

If `FABRIC_ENABLED=true` and Fabric is running, seed also registers `MEM001` on the blockchain.

### Step 3 — Start Hyperledger Fabric (if enabled)

```powershell
cd blockchain-core\backend
npm run fabric:up
npm run fabric:deploy
```

Confirm `FABRIC_ENABLED=true` and Fabric paths/PEMs are correct in `.env`.

### Step 4 — Start the backend API

```powershell
cd blockchain-core\backend
npm run dev
```

Verify: open `http://localhost:3000/api/v1/health` in a browser.

Expected: `"database": "up"`, `"ussdInternalApi": "configured"`, `"fabric": "up"` (if Fabric enabled).

### Step 5 — Start the USSD bridge

Open a **second terminal:**

```powershell
cd ussd-bridge\ussd-service
npm install
npm run dev
```

Verify: open `http://localhost:4000/health`

Expected: `"backend": "connected"`, Redis status shown.

### Step 6 — Run automated preflight check

```powershell
cd ussd-bridge\ussd-service
npm run check-setup
```

Fix any **✗** (blocking) items before continuing. **!** items are warnings.

---

## 5. Test without a real phone

### Option A — Interactive simulator

```powershell
cd ussd-bridge\ussd-service
npm run simulate
```

Use phone `+256700123456` (sample member) unless you registered a different number.

### Option B — PowerShell one-shot test

```powershell
cd ussd-bridge\ussd-service
.\test-ussd.ps1 -Phone "+256700123456"
```

### Option C — Manual POST (PowerShell)

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST `
  -ContentType "application/x-www-form-urlencoded" -Body @{
    sessionId   = "test-001"
    phoneNumber = "+256700123456"
    text        = ""
  }
```

**Expected response:** starts with `CON TrustLedger SACCO` and lists options 1–6.

### Test each menu option

| Input sequence | Expected |
|----------------|----------|
| `""` (empty) | Main menu |
| `1` | Balance (END with UGX amounts) |
| `2` | Mini statement |
| `3` | Loan status |
| `4` → amount → term → purpose → `1` | Loan application submitted |
| `5` → amount → `1` | Repayment request pending |
| `6` → amount → `1` | Savings request pending |

---

## 6. Test with Africa's Talking sandbox

### Step 1 — Create AT sandbox account

1. Go to [https://account.africastalking.com](https://account.africastalking.com)
2. Create an app in **Sandbox**
3. Copy **API Key** and note username (`sandbox`)

### Step 2 — Expose your local bridge (ngrok)

```powershell
# Install ngrok: https://ngrok.com/download
ngrok http 4000
```

Copy the HTTPS URL, e.g. `https://abc123.ngrok-free.app`

### Step 3 — Configure USSD channel in AT dashboard

1. Sandbox app → **USSD** → **Create channel**
2. **Shortcode:** `*384*13948#` (or the code AT assigns in sandbox)
3. **Callback URL:** `https://abc123.ngrok-free.app/ussd`
4. Save

### Step 4 — Set AT credentials in `.env` files

**Backend** (`blockchain-core/backend/.env`):

```
AT_USERNAME=sandbox
AT_API_KEY=your-sandbox-api-key
AT_SHORTCODE=*384*13948#
```

Restart backend and bridge after changing `.env`.

### Step 5 — Register test phone in AT sandbox

In the AT sandbox dashboard, add the phone number you will dial from as a **test number**.

### Step 6 — Register member with same phone

Admin dashboard → **Members** → Register:

- Phone must **exactly match** the SIM (E.164 format recommended: `+2567XXXXXXXX`)
- Member must be **ACTIVE**
- Member must exist on **blockchain** (registration does this automatically)

### Step 7 — Dial from handset

Dial `*384*13948#` (or your sandbox code) from the registered test SIM.

---

## 7. Production deployment (Railway)

Your app URL (from Android config): `https://trustledger-production-38cb.up.railway.app`

### Railway variables (TrustLedger service)

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Railway Postgres |
| `JWT_SECRET` | Long random string |
| `FABRIC_ENABLED` | `true` |
| `FABRIC_*` PEMs / peer endpoint | Your VPS peer details |
| `USSD_SERVICE_KEY` | Random secret |
| `BACKEND_API_KEY` | **Same as USSD_SERVICE_KEY** |
| `BACKEND_API_URL` | `http://127.0.0.1:3000/api/v1` (embedded bridge) |
| `USSD_BRIDGE_EMBED` | `true` (set by Dockerfile) |
| `REDIS_URL` | From Railway Redis plugin |
| `AT_USERNAME` | Your AT username |
| `AT_API_KEY` | Your AT API key |
| `AT_SHORTCODE` | `*384*13948#` |

### Africa's Talking production callback

```
https://trustledger-production-38cb.up.railway.app/ussd-bridge/ussd
```

### After deploy

1. Open `https://trustledger-production-38cb.up.railway.app/api/v1/health`
2. Open `https://trustledger-production-38cb.up.railway.app/api/v1/health/ussd-bridge`
3. Admin dashboard → **Integrations** — confirm all statuses green

---

## 8. Register members for USSD

USSD does **not** use email/password. It uses the **caller’s phone number**.

### Rules

1. Phone in database must match what the carrier sends (try `+2567XXXXXXXX` format).
2. Member `status` must be `ACTIVE`.
3. Member must be registered on **blockchain** (admin **Register** does both DB + chain).
4. For balance to show non-zero, admin must **deposit** or approve a savings request.

### Phone format tips

The system accepts variants: `+256700123456`, `256700123456`, `0700123456`.

**Best practice:** store phones as `+2567XXXXXXXX` when registering members.

### Quick test member (after `npm run db:seed`)

| Field | Value |
|-------|-------|
| Email | `alice@example.com` |
| Password | `Member@2024!` |
| Phone | `+256700123456` |
| Member ID | `MEM001` |

Use `+256700123456` in the simulator unless you registered a real SIM number.

---

## 9. Admin approval workflow

When a member uses USSD options **5** (repayment) or **6** (savings):

1. Request is saved in PostgreSQL (`member_requests` table).
2. Member sees: *"Request submitted — await admin approval."*
3. Admin opens dashboard → **Pending requests**.
4. Admin clicks **Approve** → blockchain write runs.
5. Member receives in-app notification (and SMS if AT is configured).

**You must approve requests** — USSD savings/repayment is not instant.

---

## 10. Health checks & monitoring

### API health

```
GET /api/v1/health
```

| Field | Good value |
|-------|------------|
| `database` | `up` |
| `fabric` | `up` (or `disabled` only for DB-only dev) |
| `ussdInternalApi` | `configured` |
| `africasTalking` | `configured` (optional, for SMS) |

### USSD bridge health

```
GET /api/v1/health/ussd-bridge        (via API — production)
GET http://localhost:4000/health      (local standalone bridge)
```

| Field | Good value |
|-------|------------|
| `backend` | `connected` |
| `redis.connected` | `true` (production) |

### Admin dashboard

**Integrations** page shows live status for PostgreSQL, Fabric, Africa's Talking, and USSD bridge.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Network error" when dialing | Callback URL wrong or server not public | Set AT callback to correct HTTPS `/ussd-bridge/ussd` URL |
| `END Your number is not registered` | Phone not in DB or inactive | Register member with exact SIM phone |
| Menu shows, balance fails | Fabric down or member not on chain | Start Fabric; register member via admin |
| `403` in bridge logs | Service key mismatch | Set `BACKEND_API_KEY` = `USSD_SERVICE_KEY` |
| `503 USSD bridge not configured` | `USSD_SERVICE_KEY` empty on API | Add to backend `.env` and restart |
| Multi-step flow resets mid-menu | Redis not connected | Set `REDIS_URL`; restart services |
| Options 5/6 fail | Migration missing | Run `npx prisma migrate deploy` |
| `check-setup` fails on backend | API not running | `npm run dev` in `blockchain-core/backend` |
| Sandbox works, production fails | Live AT credentials / callback | Use production AT app and live callback URL |
| Shortcode does nothing | Wrong code in AT dashboard | Align `*384*13948#` everywhere |

### View logs

- **Backend:** terminal running `npm run dev` in `blockchain-core/backend`
- **USSD bridge:** terminal running `npm run dev` in `ussd-bridge/ussd-service`
- **Railway:** service → Deployments → View logs

### Common log messages

```
BACKEND_API_KEY is empty          → Set in ussd-service/.env
Invalid or missing service key    → Keys don't match
No member registered for phone    → Register member with that phone
Fabric ... not connected          → Check FABRIC_ENABLED and peer endpoint
```

---

## 12. Quick reference

### Start everything locally (two terminals)

**Terminal 1 — API:**
```powershell
cd blockchain-core\backend
npm run dev
```

**Terminal 2 — USSD bridge:**
```powershell
cd ussd-bridge\ussd-service
npm run dev
```

### Verify
```powershell
cd ussd-bridge\ussd-service
npm run check-setup
npm run simulate
```

### Key file locations

| File | Purpose |
|------|---------|
| `blockchain-core/backend/.env` | API, Fabric, `USSD_SERVICE_KEY` |
| `ussd-bridge/ussd-service/.env` | Bridge, `BACKEND_API_KEY` |
| `ussd-bridge/ussd-service/check-setup.js` | Automated preflight |
| `ussd-bridge/ussd-service/simulate.js` | Terminal USSD simulator |
| `ussd-bridge/ussd-service/test-ussd.ps1` | Windows quick test |
| `blockchain-core/Dockerfile` | Railway monolith + embedded bridge |

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ussd-bridge/ussd` | POST | **Production** AT webhook (embedded) |
| `http://localhost:4000/ussd` | POST | Local standalone bridge |
| `/api/v1/health` | GET | API status |
| `/api/v1/health/ussd-bridge` | GET | Bridge status (via API) |
| `/api/v1/member-requests` | GET | Admin pending queue |

### Final go-live checklist

- [ ] PostgreSQL up, migrations applied
- [ ] Fabric peer reachable (`fabric: up` in health)
- [ ] `USSD_SERVICE_KEY` and `BACKEND_API_KEY` match
- [ ] Redis connected (production)
- [ ] AT USSD channel created with correct shortcode
- [ ] AT callback URL points to `/ussd-bridge/ussd`
- [ ] At least one member registered with real phone on blockchain
- [ ] `npm run check-setup` passes locally
- [ ] Test dial from registered SIM succeeds
- [ ] Admin can approve pending savings/repayment requests

---

**TrustLedger SACCO** — USSD bridge v1.0  
For issues, check **Integrations** in the admin dashboard and bridge/API logs first.
