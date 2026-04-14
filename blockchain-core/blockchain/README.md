# TrustLedger — Phase 1: Blockchain Layer

> Hyperledger Fabric 2.5 · Node.js Chaincode · CouchDB State Database

---

## What's Included in Phase 1

```
blockchain-core/
├── blockchain/
│   ├── network/                  ← Docker Compose, crypto, channel config
│   └── scripts/                  ← fabric-deploy.ps1, network.sh, etc.
│
└── chaincode/                    ← Node chaincode (sibling of blockchain/)
    ├── index.js                  ← Registers Savings, Loans, Ledger contracts
    ├── SavingsContract.js
    ├── LoansContract.js
    ├── LedgerContract.js
    ├── common/utils.js           ← Shared types, key builders, CouchDB helpers
    └── package.json
```

Chaincode unit tests live next to the API tests: `backend/tests/chaincode.contract.test.js` (run `npm test` from `backend/`).

---

## Prerequisites

Install these **before** running anything:

| Tool | Version | Install Guide |
|------|---------|---------------|
| Docker Desktop | ≥ 24 | https://docs.docker.com/get-docker/ |
| Node.js | ≥ 18 LTS | https://nodejs.org |
| Hyperledger Fabric Binaries | 2.5 | See below |

### Install Fabric Binaries (cryptogen, configtxgen, peer CLI)

```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
# This downloads fabric-samples + binaries + Docker images

# Add Fabric bin to PATH
export PATH=$PATH:$(pwd)/fabric-samples/bin
```

---

## Quick Start (Bring Network Up)

```bash
cd blockchain-core/blockchain/scripts

# Make the script executable
chmod +x network.sh

# Generate all crypto + channel artifacts, start Docker containers,
# create channel, and install chaincode — all in one command:
./network.sh up
```

### What `network.sh up` does, step by step:

1. Runs `cryptogen` → generates TLS certs and MSP for all nodes
2. Runs `configtxgen` → creates genesis block + channel transaction
3. `docker-compose up -d` → starts Orderer, 2 Peers, 2 CouchDBs, CA, CLI
4. Creates the `trustledger-channel` channel via CLI container
5. Both peers join the channel
6. Anchor peer update is committed
7. Chaincode is packaged, installed on both peers, approved, and committed

---

## Verify the Network is Running

```bash
# Check all containers are up
docker ps --format "table {{.Names}}\t{{.Status}}"

# Expected output:
# orderer.trustledger.com     Up X seconds
# peer0.sacco.trustledger.com Up X seconds
# peer1.sacco.trustledger.com Up X seconds
# ca.sacco.trustledger.com    Up X seconds
# couchdb0                    Up X seconds
# couchdb1                    Up X seconds
# cli                         Up X seconds

# View CouchDB (state database) in browser:
# http://localhost:5984/_utils   (peer0)
# http://localhost:6984/_utils   (peer1)
# Login: admin / adminpw
```

---

## Operators: deploy chaincode after pulling code

`git pull` only updates **chaincode source** on disk (`blockchain-core/chaincode/`). **Peers continue to run the chaincode version already committed on the channel** until you upgrade it.

After you merge or pull changes that touch chaincode (contracts, `common/utils.js`, `index.js`, etc.):

1. Ensure the Fabric network is **up** (`docker ps` shows orderer, peers, CouchDB).
2. From **`blockchain-core/backend`** (Windows, PowerShell):

   ```powershell
   npm run fabric:upgrade
   ```

   This runs `blockchain/scripts/fabric-upgrade.ps1` to package the current `chaincode/` tree, install it on peers, and commit a new definition (see script output for sequence/version).

3. **Restart the API** if it is running (`npm run dev` / `node server.js`) so any long-lived connections pick up a clean state; usually not strictly required for Gateway, but safe after major upgrades.

4. **Smoke-test** a read/write that uses changed functions (e.g. loan list, approve loan, savings history on the Audit page).

**First-time or full reset (destructive: wipes ledger volumes):** use `npm run fabric:reset` only when you intend to rebuild crypto, channel, and chaincode from scratch—not for routine code updates.

**Linux/macOS:** if you use `network.sh` or shell scripts instead of the PowerShell deploy path, follow the same rule: **pulling Git is not enough**—re-run your project’s package/install/commit steps for chaincode.

---

## Run Chaincode Tests (No Docker needed)

From `blockchain-core/backend` after `npm install`:

```bash
npm test
```

This runs `tests/chaincode.contract.test.js` together with the API integration tests.

Tests cover:
- Member registration and duplicate prevention
- Deposits and balance accumulation
- Withdrawal with minimum balance enforcement
- Loan application with policy validation (3× savings rule)
- Full loan lifecycle (apply → approve → disburse → repay)
- Loan rejection with reason requirement
- USSD balance query format
- Ledger integrity verification

---

## Smart Contract Functions Reference

### SavingsContract

| Function | Role | Description |
|----------|------|-------------|
| `registerMember` | admin | Create a new SACCO member |
| `deposit` | admin, member | Record a savings deposit |
| `withdraw` | admin | Record a withdrawal |
| `getBalance` | all | Get current savings balance |
| `getMember` | all | Get member profile |
| `getMemberTransactions` | admin, auditor, member | List member's transactions |
| `getSavingsHistory` | admin, auditor | Immutable audit trail |
| `getAllMembers` | admin, auditor | List all members |
| `updateMemberStatus` | admin | Suspend / reactivate member |

### LoansContract

| Function | Role | Description |
|----------|------|-------------|
| `applyForLoan` | admin, member | Submit a loan application |
| `approveLoan` | admin | Approve a pending loan |
| `rejectLoan` | admin | Reject with mandatory reason |
| `disburseLoan` | admin | Mark as disbursed (funds sent) |
| `repayLoan` | admin, member | Record a repayment instalment |
| `getLoan` | all | Get loan details |
| `getMemberLoans` | all | Get all loans for a member |
| `getPendingLoans` | admin | All loans awaiting approval |
| `getLoanRepayments` | admin, auditor, member | Repayment history |
| `getLoanHistory` | admin, auditor | Immutable audit trail |
| `getLoanPolicy` | all | SACCO loan rules |

### LedgerContract

| Function | Role | Description |
|----------|------|-------------|
| `getUssdBalance` | all | Optimized balance for USSD |
| `getUssdMiniStatement` | all | Last 5 txs formatted for USSD |
| `getSaccoStats` | admin, auditor | SACCO-wide dashboard stats |
| `getAllTransactions` | admin, auditor | Full transaction history |
| `getTransaction` | admin, auditor | Single transaction by ID |
| `verifyMemberBalance` | admin, auditor | Audit integrity check |
| `getTransactionsByDateRange` | admin, auditor | Date-filtered reports |

---

## Loan Policy (Hardcoded in Smart Contract)

| Rule | Value |
|------|-------|
| Minimum loan amount | UGX 100,000 |
| Maximum loan amount | UGX 50,000,000 |
| Max loan vs savings | 3× savings balance |
| Monthly interest rate | 1.5% (flat) |
| Processing fee | 1% of principal |
| Maximum term | 24 months |
| Minimum savings age | 90 days |
| Minimum savings balance | UGX 50,000 (withdrawal floor) |

---

## Tear Down Network

```bash
cd blockchain-core/blockchain/scripts

# Stop and remove all containers + volumes + crypto material
./network.sh down
```

---

## Next: Phase 2 — Backend API

The Backend API (Node.js/Express) will:
- Use `@hyperledger/fabric-gateway` SDK to call these chaincode functions
- Add PostgreSQL for user sessions and off-chain profile data
- Expose REST endpoints consumed by the React dashboard, mobile app, and USSD bridge

---

## Troubleshooting

**"cryptogen: command not found"**
→ Make sure `fabric-samples/bin` is in your `$PATH`. Run the curl install command above.

**Containers exit immediately**
→ Check logs: `docker logs peer0.sacco.trustledger.com`
→ Usually a volume permission issue. Try: `sudo chown -R $USER ./crypto-config`

**Chaincode install fails**
→ Make sure `npm install` has been run in `./chaincode` first.
→ Check the CLI container logs: `docker logs cli`

**CouchDB 401 Unauthorized**
→ Verify COUCHDB_USER/COUCHDB_PASSWORD match in docker-compose.yaml and peer environment vars.
