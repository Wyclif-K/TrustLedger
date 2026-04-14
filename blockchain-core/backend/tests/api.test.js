// =============================================================================
// TrustLedger - API Integration Tests
// =============================================================================

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.FABRIC_ENABLED = 'false';
process.env.API_PREFIX = '/api/v1';

const request = require('supertest');
const app = require('../app');

jest.mock('../services/fabric.service', () => {
  const mockMember = {
    memberId: 'MEM001', fullName: 'Alice Nakato', phone: '+256700123456',
    email: 'alice@example.com', nationalId: 'CM123456',
    status: 'ACTIVE', role: 'member', registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(),
    registeredBy: 'ADM001',
  };
  const mockSavings = {
    memberId: 'MEM001', balance: 1500000, totalDeposited: 2000000,
    totalWithdrawn: 500000, updatedAt: new Date().toISOString(),
  };
  const mockLoan = {
    loanId: 'LOAN-MEM001-001', memberId: 'MEM001', amount: 1000000,
    termMonths: 12, status: 'PENDING', totalRepayable: 1090000,
    monthlyInstalment: 90834, appliedAt: new Date().toISOString(),
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(false),
    SavingsContract: {
      submit:   jest.fn().mockImplementation((fn, ...args) => {
        if (fn === 'registerMember') return Promise.resolve({ success: true, memberId: args[0] });
        if (fn === 'deposit')        return Promise.resolve({ success: true, txId: 'TX001', newBalance: 2000000, amountDeposited: 500000 });
        if (fn === 'withdraw')       return Promise.resolve({ success: true, txId: 'TX002', newBalance: 1500000 });
        if (fn === 'updateMemberStatus') return Promise.resolve({ success: true });
        return Promise.resolve({ success: true });
      }),
      evaluate: jest.fn().mockImplementation((fn, ...args) => {
        if (fn === 'getAllMembers')        return Promise.resolve([mockMember]);
        if (fn === 'getMember') {
          if (args[0] === 'MEM001') return Promise.resolve(mockMember);
          return Promise.reject(new Error(`No record found for key: MEMBER:${args[0]}`));
        }
        if (fn === 'getBalance')          return Promise.resolve(mockSavings);
        if (fn === 'getMemberTransactions') return Promise.resolve([]);
        if (fn === 'getSavingsHistory')   return Promise.resolve([]);
        return Promise.resolve({});
      }),
    },
    LoansContract: {
      submit:   jest.fn().mockImplementation((fn, ...args) => {
        if (fn === 'applyForLoan')  return Promise.resolve({ ...mockLoan, loanId: 'LOAN-MEM001-001' });
        if (fn === 'approveLoan')   return Promise.resolve({ success: true, status: 'APPROVED' });
        if (fn === 'rejectLoan')    return Promise.resolve({ success: true, status: 'REJECTED' });
        if (fn === 'disburseLoan')  return Promise.resolve({ success: true, status: 'DISBURSED', nextDueDate: new Date().toISOString() });
        if (fn === 'repayLoan')     return Promise.resolve({ success: true, amountPaid: 90834, outstanding: 999166, isFullyRepaid: false });
        return Promise.resolve({ success: true });
      }),
      evaluate: jest.fn().mockImplementation((fn, ...args) => {
        if (fn === 'getLoan')          return Promise.resolve(mockLoan);
        if (fn === 'getMemberLoans')   return Promise.resolve([mockLoan]);
        if (fn === 'getPendingLoans')  return Promise.resolve([mockLoan]);
        if (fn === 'getAllLoans')      return Promise.resolve([mockLoan]);
        if (fn === 'getLoanRepayments') return Promise.resolve([]);
        if (fn === 'getLoanHistory')   return Promise.resolve([]);
        if (fn === 'getLoanPolicy')    return Promise.resolve({ MINIMUM_AMOUNT: 100000, MAX_MULTIPLIER: 3 });
        return Promise.resolve({});
      }),
    },
    LedgerContract: {
      submit:   jest.fn().mockResolvedValue({ success: true }),
      evaluate: jest.fn().mockImplementation((fn) => {
        if (fn === 'getSaccoStats')         return Promise.resolve({ members: { total: 5 }, savings: { totalBalance: 10000000 }, loans: { pending: 2 } });
        if (fn === 'getAllTransactions')     return Promise.resolve([]);
        if (fn === 'getTransaction')        return Promise.resolve({ txId: 'TX001', type: 'DEPOSIT' });
        if (fn === 'getTransactionsByDateRange') return Promise.resolve({ transactions: [], totals: {} });
        if (fn === 'verifyMemberBalance')   return Promise.resolve({ status: 'VERIFIED', isBalanced: true });
        if (fn === 'getUssdBalance')        return Promise.resolve({ balance: 1500000, ussdText: 'TrustLedger SACCO\nSavings: UGX 1,500,000' });
        if (fn === 'getUssdMiniStatement')  return Promise.resolve({ ussdText: 'TrustLedger Mini Stmt\n' });
        return Promise.resolve({});
      }),
    },
  };
});

jest.mock('../services/db.service', () => {
  const mockUser = {
    id: 'user-uuid-001', memberId: 'MEM001', email: 'alice@example.com',
    fullName: 'Alice Nakato', phone: '+256700123456', nationalId: 'CM123456',
    role: 'MEMBER', status: 'ACTIVE',
    passwordHash: '$2a$12$9adUp8h2qRREtzOmRFWztuaybKso0BZR5q1Oka/iG6RuL.E4a7LKa',
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-06-01T12:00:00.000Z'),
    lastLoginAt: new Date('2024-06-10T08:00:00.000Z'),
  };
  const mockAdminUser = {
    ...mockUser, id: 'admin-uuid-001', memberId: 'ADM001',
    email: 'admin@trustledger.com', role: 'ADMIN',
    passwordHash: '$2a$12$9adUp8h2qRREtzOmRFWztuaybKso0BZR5q1Oka/iG6RuL.E4a7LKa',
  };

  return {
    $connect:    jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw:   jest.fn().mockResolvedValue([{ ok: 1 }]),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.phone === '+256700123456')         return Promise.resolve(mockUser);
        if (where.email === 'admin@trustledger.com') return Promise.resolve(mockAdminUser);
        if (where.email === 'alice@example.com')     return Promise.resolve(mockUser);
        if (where.memberId === 'MEM001')             return Promise.resolve(mockUser);
        if (where.id === 'user-uuid-001')            return Promise.resolve(mockUser);
        if (where.id === 'admin-uuid-001')           return Promise.resolve(mockAdminUser);
        return Promise.resolve(null);
      }),
      create:  jest.fn().mockResolvedValue(mockUser),
      update:  jest.fn().mockResolvedValue(mockUser),
      findMany: jest.fn().mockResolvedValue([mockUser]),
      count:    jest.fn().mockImplementation(({ where }) => {
        if (where?.role === 'MEMBER' && where?.status === 'ACTIVE') return Promise.resolve(1);
        if (where?.role === 'MEMBER' && where?.status === 'SUSPENDED') return Promise.resolve(0);
        if (where?.role === 'MEMBER') return Promise.resolve(1);
        return Promise.resolve(0);
      }),
    },
    session: {
      create:     jest.fn().mockResolvedValue({ id: 'session-001' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst:  jest.fn().mockResolvedValue({
        id: 'session-001', isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockAdminUser,
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create:     jest.fn().mockResolvedValue({}),
      count:      jest.fn().mockResolvedValue(0),
      findMany:   jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
});

const JWT = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(role = 'ADMIN', memberId = 'ADM001', userId = 'admin-uuid-001') {
  return JWT.sign({ sub: userId, memberId, role, email: 'admin@trustledger.com' }, JWT_SECRET, { expiresIn: '1h' });
}

const ADMIN_TOKEN  = makeToken('ADMIN', 'ADM001', 'admin-uuid-001');
const SUPER_ADMIN_TOKEN = makeToken('SUPER_ADMIN', 'ADM001', 'admin-uuid-001');
const MEMBER_TOKEN = makeToken('MEMBER', 'MEM001', 'user-uuid-001');
const AUDITOR_TOKEN = makeToken('AUDITOR', 'AUD001', 'auditor-uuid-001');

describe('GET /api/v1/health', () => {
  test('returns 200 with service info', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('TrustLedger API');
    expect(res.body.database).toBe('up');
    expect(res.body.fabric).toBe('disabled');
    expect(res.body).toHaveProperty('ussdInternalApi');
    expect(res.body).toHaveProperty('channels');
    expect(res.body.channels).toHaveProperty('africaSTalking');
  });
});

describe('Auth Endpoints', () => {

  describe('POST /api/v1/auth/login', () => {
    test('returns tokens with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@trustledger.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    test('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'password123' });
      expect(res.status).toBe(422);
    });

    test('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    test('returns current user with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
    });

    test('rejects request without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    test('rejects request with malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer this.is.not.valid');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    test('admin can register a new member', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          memberId: 'MEM099', fullName: 'Test User',
          email: 'testuser@example.com', phone: '+256700999999',
          nationalId: 'CM999999', password: 'SecurePass123',
          role: 'MEMBER',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('non-admin cannot register members', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ memberId: 'MEM099', fullName: 'Test', email: 'x@y.com', phone: '+256700000000', nationalId: 'ID001', password: 'pass1234' });
      expect(res.status).toBe(403);
    });

    test('rejects short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ memberId: 'MEM100', fullName: 'Test', email: 'new@test.com', phone: '+256700111111', nationalId: 'ID002', password: 'short' });
      expect(res.status).toBe(422);
    });
  });
});

describe('Member Endpoints', () => {

  describe('GET /api/v1/members', () => {
    test('admin can list all members', async () => {
      const res = await request(app)
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('member cannot list all members', async () => {
      const res = await request(app)
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    test('auditor can list all members', async () => {
      const res = await request(app)
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${AUDITOR_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/members/:memberId', () => {
    test('admin can load a member profile', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM001')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        memberId: 'MEM001',
        email:    'alice@example.com',
        phone:    '+256700123456',
        fullName: 'Alice Nakato',
      });
    });

    test('returns 404 for unknown member', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM999')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(404);
    });

    test('member cannot load another member profile', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM002')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/members/:memberId/balance', () => {
    test('member can see their own balance', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM001/balance')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('balance');
    });

    test('member cannot see another member balance', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM002/balance')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    test('admin can see any member balance', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM001/balance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/members/:memberId/deposit', () => {
    test('admin can deposit for a member', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/deposit')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ amount: 500000, reference: 'REF-001', channel: 'TELLER' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('member cannot initiate deposit', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/deposit')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ amount: 500000, reference: 'REF-001' });
      expect(res.status).toBe(403);
    });

    test('rejects zero or negative amount', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/deposit')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ amount: -100, reference: 'REF-001' });
      expect(res.status).toBe(422);
    });

    test('rejects missing reference', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/deposit')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ amount: 100000 });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/members/:memberId/withdraw', () => {
    test('admin can withdraw for a member', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/withdraw')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ amount: 200000, reference: 'W-001', reason: 'Member request' });
      expect(res.status).toBe(200);
    });

    test('rejects missing reason', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/withdraw')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ amount: 200000, reference: 'W-001' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/members/:memberId/purge-ledger', () => {
    test('rejects non-super-admin', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/purge-ledger')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(403);
    });

    test('returns 503 when Fabric is disabled (test env)', async () => {
      const res = await request(app)
        .post('/api/v1/members/MEM001/purge-ledger')
        .set('Authorization', `Bearer ${SUPER_ADMIN_TOKEN}`);
      expect(res.status).toBe(503);
    });
  });

  describe('GET /api/v1/members/:memberId/verify-balance', () => {
    test('auditor can verify balance integrity', async () => {
      const res = await request(app)
        .get('/api/v1/members/MEM001/verify-balance')
        .set('Authorization', `Bearer ${AUDITOR_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
    });
  });
});

describe('Loan Endpoints', () => {

  describe('GET /api/v1/loans/policy', () => {
    test('returns loan policy without auth', async () => {
      const res = await request(app).get('/api/v1/loans/policy');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('MINIMUM_AMOUNT');
    });
  });

  describe('POST /api/v1/loans', () => {
    test('member can apply for a loan', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ memberId: 'MEM001', amount: 1000000, termMonths: 12, purpose: 'School fees payment' });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
    });

    test('rejects amount below minimum', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ memberId: 'MEM001', amount: 50000, termMonths: 6, purpose: 'Too small loan' });
      expect(res.status).toBe(422);
    });

    test('rejects term above 24 months', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ memberId: 'MEM001', amount: 1000000, termMonths: 36, purpose: 'Too long' });
      expect(res.status).toBe(422);
    });

    test('rejects short purpose', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ memberId: 'MEM001', amount: 1000000, termMonths: 6, purpose: 'abc' });
      expect(res.status).toBe(422);
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .send({ memberId: 'MEM001', amount: 1000000, termMonths: 6, purpose: 'Valid purpose here' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/loans/:loanId/approve', () => {
    test('admin can approve a loan', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/approve')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ remarks: 'Member is in good standing.' });
      expect(res.status).toBe(200);
    });

    test('member cannot approve loans', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/approve')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/loans/:loanId/reject', () => {
    test('admin can reject with reason', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/reject')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ reason: 'Insufficient savings history.' });
      expect(res.status).toBe(200);
    });

    test('rejects missing reason', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/reject')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/loans/:loanId/disburse', () => {
    test('admin can disburse approved loan', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/disburse')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ disbursementRef: 'MM-AIRTEL-789456' });
      expect(res.status).toBe(200);
    });

    test('requires disbursement reference', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/disburse')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/loans/:loanId/repay', () => {
    test('member can repay their loan', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/repay')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ amount: 90834, reference: 'MOMO-REF-001', channel: 'MOBILE_APP' });
      expect(res.status).toBe(200);
      expect(res.body.data.amountPaid).toBe(90834);
    });

    test('rejects zero amount repayment', async () => {
      const res = await request(app)
        .post('/api/v1/loans/LOAN-MEM001-001/repay')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ amount: 0, reference: 'REF-001' });
      expect(res.status).toBe(422);
    });
  });
});

describe('Reports Endpoints', () => {

  describe('GET /api/v1/reports/dashboard', () => {
    test('admin gets SACCO stats', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('members');
      expect(res.body.data).toHaveProperty('savings');
      expect(res.body.data).toHaveProperty('loans');
    });

    test('member cannot access dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/reports/range', () => {
    test('returns date range report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/range?from=2024-01-01&to=2024-01-31')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
    });

    test('rejects missing from date', async () => {
      const res = await request(app)
        .get('/api/v1/reports/range?to=2024-01-31')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect([400, 422]).toContain(res.status);
    });
  });
});

describe('USSD Endpoint', () => {

  test('main menu on first dial', async () => {
    const res = await request(app)
      .post('/api/v1/ussd')
      .type('form')
      .send({ sessionId: 'sess-001', serviceCode: '*234#', phoneNumber: '+256700123456', text: '' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('CON');
    expect(res.text).toContain('TrustLedger');
  });

  test('balance check returns END response', async () => {
    const res = await request(app)
      .post('/api/v1/ussd')
      .type('form')
      .send({ sessionId: 'sess-002', serviceCode: '*234#', phoneNumber: '+256700123456', text: '1' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('END');
  });

  test('exit returns END', async () => {
    const res = await request(app)
      .post('/api/v1/ussd')
      .type('form')
      .send({ sessionId: 'sess-003', serviceCode: '*234#', phoneNumber: '+256700123456', text: '0' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('END');
    expect(res.text).toContain('Thank you');
  });

  test('loan application flow starts with amount prompt', async () => {
    const res = await request(app)
      .post('/api/v1/ussd')
      .type('form')
      .send({ sessionId: 'sess-004', serviceCode: '*234#', phoneNumber: '+256700123456', text: '4' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('CON');
    expect(res.text).toContain('amount');
  });
});

describe('404 Handler', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
