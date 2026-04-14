# TrustLedger — Phase 2: Backend API

> Node.js · Express · Hyperledger Fabric Gateway SDK · PostgreSQL · Prisma ORM

---

## What's Included in Phase 2

```
backend/
├── .env.example
├── package.json
├── docker-compose.yml                    ← Local Postgres (npm run db:up)
├── server.js                             ← HTTP entry (Postgres + optional Fabric)
├── app.js
├── seed.js                               ← npm run db:seed
├── prisma/
│   ├── schema.prisma                     ← Prisma models
│   └── migrations/                       ← SQL migrations
├── config/
├── services/
├── middleware/
├── controllers/
├── routes/
├── utils/
└── tests/
    ├── api.test.js
    └── chaincode.contract.test.js   ← Fabric contract unit tests
```

---

## Prerequisites

- Node.js ≥ 18 LTS
- PostgreSQL 16 running locally (or Docker)
- Hyperledger Fabric network (from this repo: `npm run fabric:up` in `backend/`, then `npm run fabric:deploy` when needed)

### After you `git pull` chaincode changes

Pulling the repo updates `../chaincode/` on disk only. Peers still run the **previously committed** chaincode until you upgrade. From **`backend/`** (PowerShell): `npm run fabric:upgrade`. Full operator steps are in **`../blockchain/README.md`** (section *Operators: deploy chaincode after pulling code*).

### Start PostgreSQL with Docker (quick option)

```bash
docker run -d \
  --name trustledger-postgres \
  -e POSTGRES_USER=trustledger \
  -e POSTGRES_PASSWORD=trustledger \
  -e POSTGRES_DB=trustledger \
  -p 5432:5432 \
  postgres:16
```

---

## Quick Start

```bash
cd blockchain-core/backend

# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and verify DATABASE_URL

# 3. Run database migration
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate

# 5. Seed initial admin user
npm run db:seed

# 6. Start development server
npm run dev

# Server starts at http://localhost:3000
```

---

## Run Tests

```bash
npm test
```

Runs API integration tests and chaincode contract tests (`tests/*.test.js`).

Tests use Jest + Supertest with fully mocked Fabric and Prisma — no network or DB needed.

Covers: auth, member CRUD, deposit/withdraw, loan lifecycle, reports, USSD flows, RBAC enforcement, validation errors.

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Authentication

All protected routes require: `Authorization: Bearer <access_token>`

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Login → access + refresh token |
| POST | `/auth/logout` | Auth | Revoke session |
| POST | `/auth/refresh` | Public | Get new access token |
| POST | `/auth/register` | ADMIN | Register new member (blockchain + DB) |
| GET | `/auth/me` | Auth | Current user profile |
| PUT | `/auth/password` | Auth | Change password |

### Members

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/members` | ADMIN, AUDITOR | All members |
| GET | `/members/:id` | Self / ADMIN | Member profile |
| GET | `/members/:id/balance` | Self / ADMIN | Savings balance |
| GET | `/members/:id/transactions` | Self / ADMIN | Transaction history |
| GET | `/members/:id/savings-history` | ADMIN, AUDITOR | Immutable ledger audit |
| GET | `/members/:id/loans` | Self / ADMIN | Member's loans |
| GET | `/members/:id/verify-balance` | ADMIN, AUDITOR | Ledger integrity check |
| POST | `/members/:id/deposit` | ADMIN | Record deposit |
| POST | `/members/:id/withdraw` | ADMIN | Record withdrawal |
| PATCH | `/members/:id/status` | ADMIN | Suspend / reactivate |

### Loans

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/loans/policy` | Public | SACCO loan rules |
| GET | `/loans` | ADMIN, AUDITOR | All loans |
| GET | `/loans/:id` | Auth | Loan details |
| GET | `/loans/:id/repayments` | Auth | Repayment history |
| GET | `/loans/:id/history` | ADMIN, AUDITOR | Audit trail |
| POST | `/loans` | Auth | Apply for loan |
| POST | `/loans/:id/approve` | ADMIN | Approve |
| POST | `/loans/:id/reject` | ADMIN | Reject (reason required) |
| POST | `/loans/:id/disburse` | ADMIN | Mark disbursed |
| POST | `/loans/:id/repay` | Auth | Record repayment |

### Reports

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/reports/dashboard` | ADMIN, AUDITOR | SACCO-wide stats |
| GET | `/reports/transactions` | ADMIN, AUDITOR | All transactions |
| GET | `/reports/transactions/:txId` | ADMIN, AUDITOR | Single transaction |
| GET | `/reports/range?from=&to=` | ADMIN, AUDITOR | Date-range report |
| GET | `/reports/pending-loans` | ADMIN, AUDITOR | Pending approvals |

### USSD

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/ussd` | Public | Africa's Talking webhook |

---

## Default Login Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@trustledger.com | TrustLedger@Admin2024! |
| Auditor | auditor@trustledger.com | Auditor@2024! |
| Sample Member | alice@example.com | Member@2024! |

> ⚠️ Change all passwords before deploying to production.

---

## USSD Menu (*234#)

```
Welcome to TrustLedger SACCO
1. Check Balance
2. Mini Statement
3. Loan Status
4. Apply for Loan
5. Make Repayment
0. Exit
```

Africa's Talking (or MTN/Airtel) posts to `POST /api/v1/ussd` with:
- `sessionId`, `serviceCode`, `phoneNumber`, `text` (cumulative, `*`-separated)

---

## Architecture Notes

**Why two databases?**

- **Hyperledger Fabric (blockchain)** — source of truth for all financial data. Immutable. Every deposit, withdrawal, loan event is a block.
- **PostgreSQL (off-chain)** — stores passwords, email addresses, JWT sessions, notification history, audit logs. None of this belongs on the blockchain (PII + ephemeral data).

**Fabric Gateway calls**

- `submit` — writes to ledger (goes through endorsement + ordering). Used for: deposit, withdraw, applyForLoan, approve, repay.
- `evaluate` — reads from peer directly (no ordering). Used for: getBalance, getMember, getLoan. Much faster.

---

## Next: Phase 3 — React Admin Dashboard

The dashboard will consume these exact API endpoints to build:
- Login page → token storage
- Members table with search/filter
- Deposit / Withdraw forms
- Loan approval queue (pending loans)
- Reports with date pickers and charts
- Auditor read-only view
