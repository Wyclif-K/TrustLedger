// =============================================================================
// TrustLedger - API Routes
// =============================================================================

'use strict';

const express = require('express');
const router = express.Router();

const { validate, auditLogger } = require('../middleware');
const { authenticate, authorize, selfOrAdmin } = require('../middleware/auth.middleware');

const auth = require('../controllers/auth.controller');
const health = require('../controllers/health.controller');
const members = require('../controllers/members.controller');
const loans = require('../controllers/loans.controller');
const reports = require('../controllers/reports.controller');
const notifications = require('../controllers/notifications.controller');
const ussd = require('../controllers/ussd.controller');
const ussdInternal = require('../controllers/ussd-internal.controller');
const { requireUssdServiceKey } = require('../middleware/ussd-service.middleware');

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', health.health);

// ─── USSD bridge (microservice) — X-Service-Key + USSD_SERVICE_KEY on API ─────
router.get(
  '/internal/ussd/members/by-phone',
  requireUssdServiceKey,
  ussdInternal.byPhoneValidators,
  validate,
  ussdInternal.getMemberByPhone
);
router.get(
  '/internal/ussd/members/:memberId/ussd-balance',
  requireUssdServiceKey,
  ussdInternal.memberIdParam,
  validate,
  ussdInternal.getUssdBalance
);
router.get(
  '/internal/ussd/members/:memberId/ussd-mini-statement',
  requireUssdServiceKey,
  ussdInternal.memberIdParam,
  validate,
  ussdInternal.getUssdMiniStatement
);
router.get('/internal/ussd/members/:memberId/balance', requireUssdServiceKey, members.getBalance);
router.get('/internal/ussd/members/:memberId/loans', requireUssdServiceKey, loans.getMemberLoans);
router.post(
  '/internal/ussd/loans',
  requireUssdServiceKey,
  loans.applyValidators,
  validate,
  auditLogger,
  loans.applyForLoan
);
router.post(
  '/internal/ussd/loans/:loanId/repay',
  requireUssdServiceKey,
  loans.repayValidators,
  validate,
  auditLogger,
  loans.repayLoan
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', auth.loginValidators, validate, auth.login);
router.post('/auth/logout', auth.logout);
router.post('/auth/refresh', auth.refresh);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/password', authenticate, auth.changePasswordValidators, validate, auth.changePassword);
router.post(
  '/auth/register',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  auth.registerValidators,
  validate,
  auditLogger,
  auth.register
);

// ─── Members ──────────────────────────────────────────────────────────────────
router.get('/members', authenticate, authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'), members.getAllMembers);
router.get('/members/:memberId', authenticate, selfOrAdmin(), members.getMember);
router.get('/members/:memberId/balance', authenticate, selfOrAdmin(), members.getBalance);
router.get('/members/:memberId/transactions', authenticate, selfOrAdmin(), members.getTransactions);
router.get(
  '/members/:memberId/savings-history',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  members.getSavingsHistory
);
router.post(
  '/members/:memberId/deposit',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  members.depositValidators,
  validate,
  auditLogger,
  members.deposit
);
router.post(
  '/members/:memberId/withdraw',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  members.withdrawValidators,
  validate,
  auditLogger,
  members.withdraw
);
router.patch(
  '/members/:memberId/status',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  members.statusUpdateValidators,
  validate,
  auditLogger,
  members.updateStatus
);
router.get(
  '/members/:memberId/verify-balance',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  members.verifyBalance
);
router.post(
  '/members/:memberId/purge-ledger',
  authenticate,
  authorize('SUPER_ADMIN'),
  auditLogger,
  members.purgeLedgerMemberRecord
);
router.get('/members/:memberId/loans', authenticate, selfOrAdmin(), loans.getMemberLoans);

// ─── Loans ────────────────────────────────────────────────────────────────────
router.get('/loans/policy', loans.getLoanPolicy);
router.get('/loans', authenticate, authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'), loans.getAllLoans);
router.post('/loans', authenticate, loans.applyValidators, validate, auditLogger, loans.applyForLoan);
router.get('/loans/:loanId', authenticate, loans.getLoan);
router.post(
  '/loans/:loanId/approve',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  auditLogger,
  loans.approveLoan
);
router.post(
  '/loans/:loanId/reject',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  loans.rejectValidators,
  validate,
  auditLogger,
  loans.rejectLoan
);
router.post(
  '/loans/:loanId/disburse',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  loans.disburseValidators,
  validate,
  auditLogger,
  loans.disburseLoan
);
router.post(
  '/loans/:loanId/repay',
  authenticate,
  loans.repayValidators,
  validate,
  auditLogger,
  loans.repayLoan
);
router.get('/loans/:loanId/repayments', authenticate, loans.getLoanRepayments);
router.get('/loans/:loanId/history', authenticate, loans.getLoanHistory);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get(
  '/reports/dashboard',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.getDashboardStats
);
router.get(
  '/reports/transactions',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.getAllTransactions
);
router.get(
  '/reports/range',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.dateRangeValidators,
  validate,
  reports.getDateRangeReport
);
router.get(
  '/reports/pending-loans',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.getPendingLoans
);
router.get(
  '/reports/transactions/:txId',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.getTransaction
);
router.get(
  '/reports/monthly-trends',
  authenticate,
  authorize('ADMIN', 'AUDITOR', 'SUPER_ADMIN'),
  reports.monthlyTrendsValidators,
  validate,
  reports.getMonthlyTrends
);

// ─── Notifications (PostgreSQL) ───────────────────────────────────────────────
router.get(
  '/notifications',
  authenticate,
  notifications.listValidators,
  validate,
  notifications.list
);
router.get('/notifications/unread-count', authenticate, notifications.getUnreadCount);
router.patch('/notifications/read-all', authenticate, notifications.markAllRead);
router.patch(
  '/notifications/:id/read',
  authenticate,
  notifications.markReadValidators,
  validate,
  notifications.markRead
);

// ─── USSD (Africa's Talking / similar) ─────────────────────────────────────────
router.post('/ussd', ussd.handleUssd);

module.exports = router;
