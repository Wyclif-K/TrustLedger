# TrustLedger — `blockchain-core`

Monorepo-style folder for the **API**, **admin UI**, **Hyperledger Fabric network**, and **chaincode**.

## Layout

| Path | Role |
|------|------|
| **`backend/`** | Express API, Prisma/PostgreSQL, Fabric Gateway client. Run `npm install`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run dev`. Fabric scripts: `npm run fabric:up`, `npm run fabric:deploy`. |
| **`admin-dashboard/`** | Vite + React staff UI. `npm install`, `npm run dev` (proxies `/api` to the backend). |
| **`blockchain/`** | Docker Compose network, crypto material, shell/PowerShell scripts (`network`, deploy, upgrade). |
| **`chaincode/`** | Node chaincode (`SavingsContract`, `LoansContract`, `LedgerContract`) + `common/utils.js`. |

## Typical dev order

1. Start PostgreSQL (`backend`: `npm run db:up` or your own instance).
2. Start Fabric (`backend`: `npm run fabric:up` then `npm run fabric:deploy` when needed).
3. Configure `backend/.env` (see `backend/.env.example`).
4. `backend`: `npx prisma migrate deploy` → `npm run db:seed` → `npm run dev`.
5. `admin-dashboard`: `npm run dev` → open the printed URL (e.g. `http://localhost:5173`).

## Prisma

Schema and migrations live under **`backend/prisma/`** (standard Prisma layout).
