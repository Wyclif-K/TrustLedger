// =============================================================================
// TrustLedger - Chaincode Unit Tests
// Tests all three contracts: Savings, Loans, Ledger
// Run with API tests: npm test (from backend/)
// =============================================================================

'use strict';

const SavingsContract = require('../../chaincode/SavingsContract');
const LoansContract   = require('../../chaincode/LoansContract');
const LedgerContract  = require('../../chaincode/LedgerContract');
const {
  protobufTimestampToIsoString,
} = require('../../chaincode/common/utils');

// ─── Mock Fabric Context ──────────────────────────────────────────────────────
// Simulates the Hyperledger Fabric stub and client identity
function createMockCtx(role = 'admin') {
  const store = new Map();
  const events = [];

  return {
    stub: {
      // State
      getState:    async (key) => store.has(key) ? Buffer.from(JSON.stringify(store.get(key))) : null,
      putState:    async (key, val) => store.set(key, JSON.parse(val.toString())),
      deleteState: async (key) => { store.delete(key); },
      getTxID:     () => `TX-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
      getTxTimestamp: () => ({ seconds: { low: Math.floor(Date.now() / 1000) } }),
      setEvent:    (name, data) => events.push({ name, data: JSON.parse(data.toString()) }),
      // Rich query simulation (full scan of store)
      getQueryResult: async (queryStr) => {
        const query = JSON.parse(queryStr);
        const selector = query.selector || {};
        const results = [];

        for (const [, value] of store.entries()) {
          if (typeof value !== 'object' || value == null) continue;
          let match = true;
          for (const [k, v] of Object.entries(selector)) {
            if (typeof v === 'object' && v !== null && Array.isArray(v.$in)) {
              if (!v.$in.includes(value[k])) { match = false; break; }
              continue;
            }
            if (typeof v === 'object' && v !== null) {
              continue;
            }
            if (value[k] !== v) { match = false; break; }
          }
          if (match) results.push(value);
        }

        let idx = 0;
        return {
          next: async () => {
            if (idx >= results.length) return { done: true };
            const item = results[idx++];
            return {
              done: false,
              value: { value: Buffer.from(JSON.stringify(item)) },
            };
          },
          close: async () => {},
        };
      },
      getHistoryForKey: async () => ({
        next:  async () => ({ done: true }),
        close: async () => {},
      }),
    },
    clientIdentity: {
      getMSPID: () => 'SaccoOrgMSP',
      getID:    () => `x509::CN=User1::CN=${role}`,
      getAttributeValue: (attr) => attr === 'role' ? role : null,
    },
    // Expose store for test assertions
    _store:  store,
    _events: events,
  };
}

describe('protobuf timestamps (Fabric history vs stub)', () => {
  test('history style: seconds as plain number (toObject)', () => {
    const iso = protobufTimestampToIsoString({ seconds: 1700000000, nanos: 0 });
    expect(iso).toBe('2023-11-14T22:13:20.000Z');
  });

  test('stub style: seconds as Long-like { low, high }', () => {
    const iso = protobufTimestampToIsoString({ seconds: { low: 1700000000, high: 0 }, nanos: 0 });
    expect(iso).toBe('2023-11-14T22:13:20.000Z');
  });
});

// ─── SavingsContract Tests ────────────────────────────────────────────────────
describe('SavingsContract', () => {
  let contract;
  let ctx;

  beforeEach(() => {
    contract = new SavingsContract();
    ctx = createMockCtx('admin');
  });

  test('initLedger should succeed', async () => {
    const result = await contract.initLedger(ctx);
    expect(result.success).toBe(true);
  });

  test('registerMember creates member and savings account', async () => {
    const result = await contract.registerMember(
      ctx, 'MEM001', 'Alice Nakato', '+256700123456', 'CM900123456', 'member'
    );
    expect(result.success).toBe(true);
    expect(result.memberId).toBe('MEM001');

    // Verify member was stored
    const member = await contract.getMember(ctx, 'MEM001');
    expect(member.fullName).toBe('Alice Nakato');
    expect(member.status).toBe('ACTIVE');

    // Verify savings account was created with zero balance
    const balance = await contract.getBalance(ctx, 'MEM001');
    expect(balance.balance).toBe(0);
  });

  test('registerMember prevents duplicate IDs', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await expect(
      contract.registerMember(ctx, 'MEM001', 'Bob', '+256700000002', 'ID002')
    ).rejects.toThrow("Member 'MEM001' already exists");
  });

  test('deposit increases balance and records transaction', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');

    const result = await contract.deposit(ctx, 'MEM001', '500000', '[MOBILE_APP] REF001');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(500000);
    expect(result.amountDeposited).toBe(500000);
    expect(ctx._events.some(e => e.name === 'Deposit')).toBe(true);
  });

  test('deposit rejects negative amounts', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await expect(
      contract.deposit(ctx, 'MEM001', '-100', 'REF001')
    ).rejects.toThrow('must be a positive number');
  });

  test('withdraw reduces balance and enforces minimum balance', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await contract.deposit(ctx, 'MEM001', '1000000', 'REF001');

    const result = await contract.withdraw(ctx, 'MEM001', '800000', 'W001|||!TLW!|||Emergency');
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(200000);
  });

  test('withdraw records channel from [CHANNEL] prefix', async () => {
    await contract.registerMember(ctx, 'MEM007', 'Zed', '+256700000007', 'ID007');
    await contract.deposit(ctx, 'MEM007', '2000000', 'SEED');
    const result = await contract.withdraw(
      ctx,
      'MEM007',
      '500000',
      '[BANK_TRANSFER] W-BNK-1|||!TLW!|||School fees'
    );
    expect(result.success).toBe(true);
  });

  test('withdraw enforces minimum balance of 50,000', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await contract.deposit(ctx, 'MEM001', '200000', 'REF001');

    // Try to withdraw all but leave less than 50,000
    await expect(
      contract.withdraw(ctx, 'MEM001', '160001', 'W001|||!TLW!|||Test')
    ).rejects.toThrow('minimum balance');
  });

  test('multiple deposits accumulate balance correctly', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await contract.deposit(ctx, 'MEM001', '200000', 'R1');
    await contract.deposit(ctx, 'MEM001', '300000', 'R2');
    await contract.deposit(ctx, 'MEM001', '100000', 'R3');

    const balance = await contract.getBalance(ctx, 'MEM001');
    expect(balance.balance).toBe(600000);
    expect(balance.totalDeposited).toBe(600000);
  });

  test('purgeLedgerMember removes state so ID can be re-registered', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    const purge = await contract.purgeLedgerMember(ctx, 'MEM001');
    expect(purge.success).toBe(true);
    await expect(contract.getMember(ctx, 'MEM001')).rejects.toThrow();
    const reg2 = await contract.registerMember(ctx, 'MEM001', 'New Alice', '+256700000002', 'ID099');
    expect(reg2.success).toBe(true);
  });

  test('purgeLedgerMember rejects when savings balance is not zero', async () => {
    await contract.registerMember(ctx, 'MEM001', 'Alice', '+256700000001', 'ID001');
    await contract.deposit(ctx, 'MEM001', '100000', 'R1');
    await expect(contract.purgeLedgerMember(ctx, 'MEM001')).rejects.toThrow('balance');
  });
});

// ─── LoansContract Tests ──────────────────────────────────────────────────────
describe('LoansContract', () => {
  let savingsContract;
  let loansContract;
  let ctx;

  beforeEach(async () => {
    savingsContract = new SavingsContract();
    loansContract   = new LoansContract();
    ctx = createMockCtx('admin');

    // Setup: Register a member with sufficient savings
    await savingsContract.registerMember(ctx, 'MEM002', 'Bob Okello', '+256700000002', 'ID002');
    await savingsContract.deposit(ctx, 'MEM002', '5000000', 'SEED_DEPOSIT');
  });

  test('initLedger should succeed', async () => {
    const result = await loansContract.initLedger(ctx);
    expect(result.success).toBe(true);
  });

  test('applyForLoan creates a PENDING loan', async () => {
    const result = await loansContract.applyForLoan(
      ctx, 'MEM002', '1000000', '12', 'School fees'
    );
    expect(result.success).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(result.amount).toBe(1000000);
    expect(result.monthlyInstalment).toBeGreaterThan(0);
  });

  test('applyForLoan rejects amount below minimum', async () => {
    await expect(
      loansContract.applyForLoan(ctx, 'MEM002', '50000', '12', 'Too small')
    ).rejects.toThrow('Minimum loan amount');
  });

  test('applyForLoan rejects if loan exceeds 3× savings', async () => {
    // Savings = 5,000,000 so max loan = 15,000,000
    await expect(
      loansContract.applyForLoan(ctx, 'MEM002', '16000000', '24', 'Too big')
    ).rejects.toThrow('exceeds the maximum allowed');
  });

  test('approveLoan changes status to APPROVED', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '1000000', '12', 'Business capital'
    );
    const result = await loansContract.approveLoan(ctx, application.loanId, 'Looks good');
    expect(result.success).toBe(true);
    expect(result.status).toBe('APPROVED');
  });

  test('rejectLoan requires a reason', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '1000000', '12', 'Business'
    );
    await expect(
      loansContract.rejectLoan(ctx, application.loanId, '')
    ).rejects.toThrow('rejection reason must be provided');
  });

  test('disburseLoan moves loan to DISBURSED and sets due date', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '1000000', '6', 'Medical'
    );
    await loansContract.approveLoan(ctx, application.loanId);
    const result = await loansContract.disburseLoan(ctx, application.loanId, 'MM-REF-001');

    expect(result.status).toBe('DISBURSED');
    expect(result.nextDueDate).toBeDefined();
  });

  test('repayLoan reduces outstanding balance', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '1000000', '6', 'Medical'
    );
    await loansContract.approveLoan(ctx, application.loanId);
    await loansContract.disburseLoan(ctx, application.loanId, 'MM-REF-001');

    const result = await loansContract.repayLoan(
      ctx, application.loanId, '200000', 'REPAY-REF-001', 'MOBILE_APP'
    );
    expect(result.success).toBe(true);
    expect(result.amountPaid).toBe(200000);
    expect(result.outstanding).toBeLessThan(application.totalRepayable);
  });

  test('full loan lifecycle: apply → approve → disburse → repay fully', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '100000', '1', 'Emergency'
    );
    await loansContract.approveLoan(ctx, application.loanId);
    await loansContract.disburseLoan(ctx, application.loanId, 'MM-REF-002');

    // Repay full amount
    const repay = await loansContract.repayLoan(
      ctx, application.loanId, String(application.totalRepayable), 'FINAL-REPAY', 'TELLER'
    );
    expect(repay.isFullyRepaid).toBe(true);

    const loan = await loansContract.getLoan(ctx, application.loanId);
    expect(loan.status).toBe('REPAID');
  });

  test('getLoanPolicy returns valid policy object', async () => {
    const policy = await loansContract.getLoanPolicy(ctx);
    expect(policy.MINIMUM_AMOUNT).toBe(100000);
    expect(policy.MAX_MULTIPLIER).toBe(3);
  });

  test('getAllLoans returns full loan docs; filters by status', async () => {
    const application = await loansContract.applyForLoan(
      ctx, 'MEM002', '100000', '6', 'Business'
    );
    const all = await loansContract.getAllLoans(ctx, 'ALL');
    expect(all.some((l) => l.loanId === application.loanId)).toBe(true);

    const pendingOnly = await loansContract.getAllLoans(ctx, 'PENDING');
    expect(pendingOnly.every((l) => l.status === 'PENDING')).toBe(true);

    await loansContract.approveLoan(ctx, application.loanId, 'ok');
    const approved = await loansContract.getAllLoans(ctx, 'APPROVED');
    expect(approved.some((l) => l.loanId === application.loanId && l.status === 'APPROVED')).toBe(true);
  });
});

// ─── LedgerContract Tests ─────────────────────────────────────────────────────
describe('LedgerContract', () => {
  let ledgerContract;
  let savingsContract;
  let ctx;

  beforeEach(async () => {
    ledgerContract  = new LedgerContract();
    savingsContract = new SavingsContract();
    ctx = createMockCtx('admin');
  });

  test('initLedger seeds SACCO metadata', async () => {
    const result = await ledgerContract.initLedger(ctx);
    expect(result.success).toBe(true);
  });

  test('getSaccoStats returns expected structure', async () => {
    const stats = await ledgerContract.getSaccoStats(ctx);
    expect(stats).toHaveProperty('members');
    expect(stats).toHaveProperty('savings');
    expect(stats).toHaveProperty('loans');
    expect(stats).toHaveProperty('generatedAt');
  });

  test('getUssdBalance returns ussdText string', async () => {
    await savingsContract.registerMember(ctx, 'MEM003', 'Carol', '+256700000003', 'ID003');
    await savingsContract.deposit(ctx, 'MEM003', '300000', 'R1');

    const result = await ledgerContract.getUssdBalance(ctx, 'MEM003');
    expect(result.memberId).toBe('MEM003');
    expect(result.balance).toBe(300000);
    expect(typeof result.ussdText).toBe('string');
    expect(result.ussdText).toContain('TrustLedger');
  });

  test('verifyMemberBalance detects integrity', async () => {
    await savingsContract.registerMember(ctx, 'MEM004', 'David', '+256700000004', 'ID004');
    await savingsContract.deposit(ctx, 'MEM004', '500000', 'R1');
    await savingsContract.deposit(ctx, 'MEM004', '200000', 'R2');

    const result = await ledgerContract.verifyMemberBalance(ctx, 'MEM004');
    expect(result.status).toBe('VERIFIED');
    expect(result.storedBalance).toBe(700000);
  });
});
