// =============================================================================
// TrustLedger USSD Service - Test Suite
// Tests the router, all handlers, and response builder with mocked backends.
// Run: npm test
// =============================================================================

'use strict';

const request = require('supertest');

// ── Mock Redis session store ───────────────────────────────────────────────────
const sessionData = new Map();

jest.mock('./services/session.service', () => ({
  connect:       jest.fn().mockResolvedValue(undefined),
  disconnect:    jest.fn().mockResolvedValue(undefined),
  getSession:    jest.fn().mockImplementation(async (id) => sessionData.get(id) || null),
  setSession:    jest.fn().mockImplementation(async (id, data) => { sessionData.set(id, data); }),
  updateSession: jest.fn().mockImplementation(async (id, updates) => {
    const existing = sessionData.get(id) || {};
    sessionData.set(id, { ...existing, ...updates });
  }),
  deleteSession: jest.fn().mockImplementation(async (id) => sessionData.delete(id)),
  ping:          jest.fn().mockResolvedValue({ status: 'memory', connected: false }),
}));

// ── Mock backend API service ───────────────────────────────────────────────────
jest.mock('./services/backend.service', () => ({
  getMemberByPhone:   jest.fn().mockResolvedValue({ memberId: 'MEM001', fullName: 'Alice Nakato' }),
  getUssdBalance:     jest.fn().mockResolvedValue({ balance: 1500000, loanBalance: 0, nextDueDate: null }),
  getMiniStatement:   jest.fn().mockResolvedValue({
    transactions: [
      { type: 'DEPOSIT', amount: 500000, timestamp: '2024-03-01T10:00:00Z' },
      { type: 'WITHDRAWAL', amount: 100000, timestamp: '2024-03-05T09:00:00Z' },
    ],
  }),
  getBalance:         jest.fn().mockResolvedValue({ balance: 1500000 }),
  getActiveLoan:      jest.fn().mockResolvedValue({
    loanId: 'LOAN-MEM001-001-ABC', status: 'DISBURSED',
    amount: 1000000, outstandingBalance: 820000,
    monthlyInstalment: 91000, nextDueDate: '2024-04-01T00:00:00Z',
  }),
  getDisbursedLoan:   jest.fn().mockResolvedValue({
    loanId: 'LOAN-MEM001-001-ABC', status: 'DISBURSED',
    amount: 1000000, outstandingBalance: 820000,
    monthlyInstalment: 91000, nextDueDate: '2024-04-01T00:00:00Z',
  }),
  applyForLoan:       jest.fn().mockResolvedValue({ loanId: 'LOAN-MEM001-NEW-XYZ', status: 'PENDING' }),
  repayLoan:          jest.fn().mockResolvedValue({ amountPaid: 91000, outstanding: 729000, isFullyRepaid: false }),
  getLoanPolicy:      jest.fn().mockResolvedValue({ INTEREST_RATE_MONTHLY: 0.015, PROCESSING_FEE_RATE: 0.01 }),
  checkBackendHealth: jest.fn().mockResolvedValue({ ok: true }),
}));

// ── Mock SMS service ───────────────────────────────────────────────────────────
jest.mock('./services/sms.service', () => ({
  init: jest.fn(),
  send: jest.fn().mockResolvedValue(undefined),
  sms: {
    balanceEnquiry:           jest.fn().mockResolvedValue(undefined),
    loanApplicationReceived:  jest.fn().mockResolvedValue(undefined),
    loanRepaymentConfirmed:   jest.fn().mockResolvedValue(undefined),
  },
}));

const app = require('./app');

// ── Helper: post USSD request ──────────────────────────────────────────────────
function ussd({ sessionId = 'sess-test-001', phone = '+256700123456', text = '' } = {}) {
  return request(app)
    .post('/ussd')
    .type('form')
    .send({ sessionId, serviceCode: '*234#', phoneNumber: phone, text, networkCode: '63902' });
}

// ── Helper: seed session with member resolved ──────────────────────────────────
function seedSession(sessionId, overrides = {}) {
  sessionData.set(sessionId, {
    phone:    '+256700123456',
    memberId: 'MEM001',
    fullName: 'Alice Nakato',
    ...overrides,
  });
}

// ── Reset between tests ────────────────────────────────────────────────────────
beforeEach(() => sessionData.clear());

// =============================================================================
// Health Check
// =============================================================================
describe('GET /health', () => {
  test('returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('TrustLedger USSD Bridge');
  });
});

// =============================================================================
// Main Menu
// =============================================================================
describe('Main Menu (first dial)', () => {
  test('shows main menu on empty text', async () => {
    const res = await ussd({ text: '' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('CON');
    expect(res.text).toContain('TrustLedger SACCO');
    expect(res.text).toContain('1. Check Balance');
    expect(res.text).toContain('4. Apply for Loan');
    expect(res.text).toContain('5. Make Repayment');
  });

  test('response is plain text not JSON', async () => {
    const res = await ussd({ text: '' });
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  test('option 0 exits the session', async () => {
    seedSession('sess-exit-001');
    const res = await ussd({ sessionId: 'sess-exit-001', text: '0' });
    expect(res.text).toContain('END');
    expect(res.text).toContain('Thank you');
  });

  test('invalid option shows error with menu', async () => {
    seedSession('sess-invalid-001');
    const res = await ussd({ sessionId: 'sess-invalid-001', text: '9' });
    expect(res.text).toContain('Invalid option');
    expect(res.text).toContain('CON');
  });
});

// =============================================================================
// Balance (Option 1)
// =============================================================================
describe('Option 1 — Check Balance', () => {
  test('returns END with balance info', async () => {
    seedSession('sess-bal-001');
    const res = await ussd({ sessionId: 'sess-bal-001', text: '1' });
    expect(res.text).toContain('END');
    expect(res.text).toContain('MEM001');
    expect(res.text).toMatch(/1,500,000|1\.5M/);
  });

  test('unregistered phone shows error', async () => {
    const backend = require('./services/backend.service');
    backend.getMemberByPhone.mockResolvedValueOnce(null);
    const res = await ussd({ phone: '+256700999999', text: '' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/not registered|branch/i);
  });
});

// =============================================================================
// Mini Statement (Option 2)
// =============================================================================
describe('Option 2 — Mini Statement', () => {
  test('returns END with transaction lines', async () => {
    seedSession('sess-stmt-001');
    const res = await ussd({ sessionId: 'sess-stmt-001', text: '2' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/DEP|WDR|500/);
  });
});

// =============================================================================
// Loan Status (Option 3)
// =============================================================================
describe('Option 3 — Loan Status', () => {
  test('shows active loan status', async () => {
    seedSession('sess-loan-001');
    const res = await ussd({ sessionId: 'sess-loan-001', text: '3' });
    expect(res.text).toContain('END');
    expect(res.text).toContain('DISBURSED');
    expect(res.text).toMatch(/820,000|820K/);
  });

  test('shows no active loan message when none exists', async () => {
    const backend = require('./services/backend.service');
    backend.getActiveLoan.mockResolvedValueOnce(null);
    seedSession('sess-no-loan-001');
    const res = await ussd({ sessionId: 'sess-no-loan-001', text: '3' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/No active loans|no active/i);
  });
});

// =============================================================================
// Loan Application Flow (Option 4)
// =============================================================================
describe('Option 4 — Loan Application', () => {
  const SID = 'sess-apply-001';
  beforeEach(() => seedSession(SID));

  test('step 0: starts with amount prompt', async () => {
    const backend = require('./services/backend.service');
    backend.getActiveLoan.mockResolvedValueOnce(null); // No existing loan
    const res = await ussd({ sessionId: SID, text: '4' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/amount|UGX/i);
  });

  test('step 1: rejects amount below minimum', async () => {
    backend_mockNoLoan();
    await ussd({ sessionId: SID, text: '4' }); // start
    sessionData.set(SID, { ...sessionData.get(SID), flow: 'LOAN_APPLY', step: 'amount', data: {} });
    const res = await ussd({ sessionId: SID, text: '4*50000' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/low|min/i);
  });

  test('step 1: accepts valid amount and shows term prompt', async () => {
    sessionData.set(SID, { memberId: 'MEM001', phone: '+256700123456', flow: 'LOAN_APPLY', step: 'amount', data: {} });
    const res = await ussd({ sessionId: SID, text: '4*500000' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/1\. 3 months|period/i);
  });

  test('step 2: selects term and shows purpose prompt', async () => {
    sessionData.set(SID, { memberId: 'MEM001', phone: '+256700123456', flow: 'LOAN_APPLY', step: 'term', data: { amount: 500000 } });
    const res = await ussd({ sessionId: SID, text: '4*500000*2' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/purpose/i);
  });

  test('step 3: enters purpose and shows confirm screen', async () => {
    sessionData.set(SID, { memberId: 'MEM001', phone: '+256700123456', flow: 'LOAN_APPLY', step: 'purpose', data: { amount: 500000, termMonths: 6 } });
    const res = await ussd({ sessionId: SID, text: '4*500000*2*School fees' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/Confirm|1\. Confirm/i);
  });

  test('step 4: confirms application and submits', async () => {
    sessionData.set(SID, {
      memberId: 'MEM001', phone: '+256700123456',
      flow: 'LOAN_APPLY', step: 'confirm',
      data: { amount: 500000, termMonths: 6, purpose: 'School fees', monthlyInstalment: 88000, totalRepayable: 528000 },
    });
    const res = await ussd({ sessionId: SID, text: '4*500000*2*School fees*1' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/submitted|Ref/i);
  });

  test('step 4: cancels gracefully', async () => {
    sessionData.set(SID, {
      memberId: 'MEM001', phone: '+256700123456',
      flow: 'LOAN_APPLY', step: 'confirm',
      data: { amount: 500000, termMonths: 6, purpose: 'Business', monthlyInstalment: 88000, totalRepayable: 528000 },
    });
    const res = await ussd({ sessionId: SID, text: '4*500000*2*Business*2' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/cancel/i);
  });

  test('blocks application when active loan exists', async () => {
    const res = await ussd({ sessionId: SID, text: '4' }); // getActiveLoan returns loan by default
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/active loan|Repay/i);
  });
});

// =============================================================================
// Repayment Flow (Option 5)
// =============================================================================
describe('Option 5 — Loan Repayment', () => {
  const SID = 'sess-repay-001';
  beforeEach(() => seedSession(SID));

  test('starts with amount prompt showing outstanding balance', async () => {
    const res = await ussd({ sessionId: SID, text: '5' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/Outstanding|amount/i);
  });

  test('rejects amount exceeding outstanding balance', async () => {
    sessionData.set(SID, {
      memberId: 'MEM001', phone: '+256700123456',
      flow: 'REPAYMENT', step: 'amount',
      data: { loanId: 'LOAN-001', outstandingBalance: 820000, monthlyInstalment: 91000 },
    });
    const res = await ussd({ sessionId: SID, text: '5*2000000' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/exceed|balance/i);
  });

  test('valid amount shows confirm screen', async () => {
    sessionData.set(SID, {
      memberId: 'MEM001', phone: '+256700123456',
      flow: 'REPAYMENT', step: 'amount',
      data: { loanId: 'LOAN-001', outstandingBalance: 820000, monthlyInstalment: 91000 },
    });
    const res = await ussd({ sessionId: SID, text: '5*91000' });
    expect(res.text).toContain('CON');
    expect(res.text).toMatch(/Confirm|1\. Confirm/i);
  });

  test('confirmation submits repayment and returns success', async () => {
    sessionData.set(SID, {
      memberId: 'MEM001', phone: '+256700123456',
      flow: 'REPAYMENT', step: 'confirm',
      data: { loanId: 'LOAN-001', outstandingBalance: 820000, monthlyInstalment: 91000, repayAmount: 91000 },
    });
    const res = await ussd({ sessionId: SID, text: '5*91000*1' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/confirmed|payment/i);
  });

  test('no disbursed loan shows helpful message', async () => {
    const backend = require('./services/backend.service');
    backend.getDisbursedLoan.mockResolvedValueOnce(null);
    const res = await ussd({ sessionId: SID, text: '5' });
    expect(res.text).toContain('END');
    expect(res.text).toMatch(/No active loan|repayment/i);
  });
});

// =============================================================================
// Validation
// =============================================================================
describe('Request Validation', () => {
  test('missing sessionId returns 400', async () => {
    const res = await request(app)
      .post('/ussd')
      .type('form')
      .send({ phoneNumber: '+256700123456', text: '' });
    expect(res.status).toBe(400);
  });

  test('missing phoneNumber returns 400', async () => {
    const res = await request(app)
      .post('/ussd')
      .type('form')
      .send({ sessionId: 'sess-001', text: '' });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// Response Builder Unit Tests
// =============================================================================
describe('Response Builder', () => {
  const { con, end, responses, formatAmount, formatDate } = require('./utils/response.builder');

  test('con() prefixes with CON', () => {
    expect(con('Hello')).toBe('CON Hello');
  });

  test('end() prefixes with END', () => {
    expect(end('Bye')).toBe('END Bye');
  });

  test('formatAmount formats large numbers', () => {
    expect(formatAmount(1500000)).toContain('1,500,000');
  });

  test('formatDate handles ISO string', () => {
    expect(formatDate('2024-03-15T10:00:00Z')).toBe('15/03/2024');
  });

  test('formatDate returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  test('balance response starts with END', () => {
    const r = responses.balance('MEM001', 500000, 0, null);
    expect(r).toContain('END');
    expect(r).toContain('MEM001');
  });

  test('miniStatement handles empty transactions', () => {
    const r = responses.miniStatement('MEM001', []);
    expect(r).toContain('END');
    expect(r).toContain('No transactions');
  });

  test('loanConfirm shows confirm options', () => {
    const r = responses.loanConfirm(500000, 6, 88000, 528000);
    expect(r).toContain('CON');
    expect(r).toContain('1. Confirm');
    expect(r).toContain('2. Cancel');
  });

  test('repaySuccess for fully repaid loan', () => {
    const r = responses.repaySuccess(820000, 0, 'REF-123');
    expect(r).toContain('END');
    expect(r).toContain('REPAID');
  });
});

// ── Helper: mock no active loan for flow tests ─────────────────────────────────
function backend_mockNoLoan() {
  const backend = require('./services/backend.service');
  backend.getActiveLoan.mockResolvedValueOnce(null);
}
