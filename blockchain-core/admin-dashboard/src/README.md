# TrustLedger — Phase 3: React Admin Dashboard

> React 19 · Vite · TailwindCSS · TanStack Query · Recharts · Zustand

---

## What's Included in Phase 3

```
admin-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx                         ← React entry point + QueryClient
    ├── App.jsx                          ← Router with protected routes
    ├── index.css                        ← Tailwind + custom component classes
    │
    ├── services/
    │   └── api.js                       ← Axios client, token injection, auto-refresh
    │
    ├── store/
    │   └── auth.store.js                ← Zustand auth store (persisted)
    │
    ├── utils/
    │   └── helpers.js                   ← Currency, date, status formatters
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.jsx              ← Navigation sidebar with RBAC filtering
    │   │   └── AppLayout.jsx            ← Shell layout (sidebar + header + outlet)
    │   └── ui/
    │       └── index.jsx                ← Badge, Modal, Input, Select, StatCard,
    │                                        EmptyState, TableSkeleton, ConfirmDialog
    │
    └── pages/
        ├── Login.jsx                    ← Auth page with form validation
        ├── Dashboard.jsx                ← Stats + area chart + pie + pending loans
        ├── Members.jsx                  ← Member table, search, deposit/withdraw modals
        ├── MemberDetail.jsx             ← Profile, balance card, TX history, loans
        ├── Loans.jsx                    ← Loan queue with approve/reject/disburse/repay
        ├── Reports.jsx                  ← Date range reports + bar chart + TX explorer
        └── Audit.jsx                    ← Balance verifier + savings history timeline
```

---

## Quick Start

```bash
cd blockchain-core/admin-dashboard

npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:3000` (Phase 2 backend).
Make sure the backend is running first.

---

## Build for Production

```bash
npm run build
# Output: dist/
```

Serve `dist/` from Nginx or any static host.
Point your web server to proxy `/api/*` to the Node.js backend.

---

## Pages & Features

### Login (`/login`)
- Email + password form with react-hook-form validation
- Auto-redirects to dashboard if already authenticated
- JWT stored in Zustand (persisted to localStorage)
- Automatic token refresh on 401 via Axios interceptor
- Idle timeout warning/logout (configurable via Vite env vars below)

#### Optional Vite env vars (idle timeout)

Set these in `admin-dashboard/.env` (or `.env.local`) and restart Vite:

```bash
VITE_IDLE_WARNING_MINUTES=10
VITE_IDLE_LOGOUT_MINUTES=15
```

- `VITE_IDLE_WARNING_MINUTES`: when warning popup appears
- `VITE_IDLE_LOGOUT_MINUTES`: automatic logout time
- If logout is set less than warning, the app enforces at least warning + 1 minute

### Dashboard (`/dashboard`)
- Live SACCO stats: total members, savings balance, active loans, pending approvals
- Area chart: Savings vs Loan activity (last 7 months)
- Pie chart: Loan status distribution
- Pending approval queue with quick Review links
- Recent transactions feed

### Members (`/members`)
- Full member table with search (name/ID/phone) and status filter
- Row action menu: View Profile, Deposit, Withdraw, Suspend/Reactivate
- Register Member modal (Admin only) — registers on blockchain + PostgreSQL
- Deposit/Withdraw modals with reference and channel fields
- Confirm dialog for status changes

### Member Detail (`/members/:memberId`)
- Balance card (gradient, shows deposits/withdrawals totals)
- Member information panel
- Full transaction history from blockchain
- Loan history table with status badges

### Loans (`/loans`)
- Multi-status filter tabs (All, Pending, Approved, Disbursed, Repaid, Rejected)
- Search by member ID or loan ID
- Inline action buttons per status:
  - PENDING → Approve + Reject buttons
  - APPROVED → Disburse button
  - DISBURSED → Repay button
- Approve modal with remarks
- Reject modal with mandatory reason
- Disburse modal with payment reference
- Repay modal pre-filled with monthly instalment

### Reports (`/reports`)
- Date range picker → generates blockchain report
- Summary cards: deposits, withdrawals, loan repayments
- Bar chart of totals by transaction type
- Full transaction table with type, amount, channel
- Recent transactions explorer with live search

### Audit Trail (`/audit`)
- Balance Integrity Verifier: re-computes balance from all TXs vs stored balance
- VERIFIED / DISCREPANCY result with full breakdown
- Savings Account History: immutable timeline of all state changes on the ledger
- Timeline view showing each block with before/after balance values

---

## Role-Based UI

| Feature | MEMBER | ADMIN | AUDITOR | SUPER_ADMIN |
|---------|--------|-------|---------|-------------|
| Dashboard | ✗ | ✓ | ✓ | ✓ |
| View Members | ✗ | ✓ | ✓ | ✓ |
| Register Member | ✗ | ✓ | ✗ | ✓ |
| Deposit / Withdraw | ✗ | ✓ | ✗ | ✓ |
| Approve Loans | ✗ | ✓ | ✗ | ✓ |
| Reports | ✗ | ✓ | ✓ | ✓ |
| Audit Trail | ✗ | ✓ | ✓ | ✓ |

---

## Design System

**Typography:** DM Serif Display (headings) + DM Sans (body) + JetBrains Mono (amounts)

**Color palette:**
- Brand: Gold (`brand-*`, e.g. `#F6A609`) + navy (`navy-*`, e.g. `#0B1B32`) — matches mobile TrustLedger palette
- Surface: Stone (`surface-*`) — backgrounds, borders, text
- Status: Emerald (active/deposit), Amber (pending), Violet (disbursed), Red (rejected/withdrawal)

**Components:** All defined as Tailwind `@layer components` in `index.css` — `btn-primary`, `btn-secondary`, `btn-danger`, `card`, `input`, `table`, `badge-*`, `stat-card`, `nav-item`

---

## Next: Phase 4 — Android App (Kotlin + Jetpack Compose)

The mobile app connects to the same Phase 2 backend API and provides:
- Member login with biometric support
- Balance check (blockchain-live)
- Deposit initiation
- Loan application
- Repayment via mobile money
- Push notifications for loan status changes
