// =============================================================================
// TrustLedger - Member Requests Controller
// Off-chain queue for savings deposits and loan repayments submitted by members
// via USSD or mobile app. Administrators approve before blockchain writes.
// =============================================================================

'use strict';

const { body, param, query } = require('express-validator');
const prisma = require('../services/db.service');
const fabricService = require('../services/fabric.service');
const { createInAppNotification } = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../config/logger');

const MIN_SAVINGS = 1_000;
const MAX_SAVINGS = 50_000_000;

async function assertActiveMember(memberId) {
  const user = await prisma.user.findUnique({
    where:  { memberId },
    select: { memberId: true, status: true, fullName: true },
  });
  if (!user) return { ok: false, status: 404, message: 'Member not found.' };
  if (user.status !== 'ACTIVE') {
    return { ok: false, status: 403, message: 'Your account is not active. Visit the branch.' };
  }
  return { ok: true, user };
}

function buildReference(prefix, channel) {
  return `${prefix}-${channel}-${Date.now()}`;
}

async function createSavingsDepositRequest(memberId, amount, channel, reference) {
  const check = await assertActiveMember(memberId);
  if (!check.ok) return check;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < MIN_SAVINGS || amt > MAX_SAVINGS) {
    return { ok: false, status: 400, message: `Amount must be between UGX ${MIN_SAVINGS.toLocaleString()} and UGX ${MAX_SAVINGS.toLocaleString()}.` };
  }

  const ref = reference || buildReference('SAV', channel);
  const row = await prisma.memberRequest.create({
    data: {
      memberId,
      type:     'SAVINGS_DEPOSIT',
      amount:   amt,
      reference: ref,
      channel,
    },
  });

  await createInAppNotification(
    memberId,
    'GENERAL',
    'Savings deposit submitted',
    `Your savings deposit of UGX ${amt.toLocaleString()} (ref: ${ref}) is pending admin approval.`
  );

  logger.info(`Savings request queued: ${memberId} UGX ${amt} via ${channel}`);
  return { ok: true, data: row };
}

async function createLoanRepaymentRequest(memberId, loanId, amount, channel, reference) {
  const check = await assertActiveMember(memberId);
  if (!check.ok) return check;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, status: 400, message: 'Repayment amount must be positive.' };
  }

  let loan;
  try {
    loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
  } catch (err) {
    return { ok: false, status: 404, message: 'Loan not found.' };
  }

  if (loan.memberId !== memberId) {
    return { ok: false, status: 403, message: 'This loan does not belong to you.' };
  }
  if (loan.status !== 'DISBURSED') {
    return { ok: false, status: 400, message: 'Only active disbursed loans can be repaid.' };
  }
  if (amt > Number(loan.outstandingBalance)) {
    return { ok: false, status: 400, message: 'Amount exceeds outstanding loan balance.' };
  }

  const ref = reference || buildReference('REPAY', channel);
  const row = await prisma.memberRequest.create({
    data: {
      memberId,
      type:      'LOAN_REPAYMENT',
      amount:    amt,
      reference: ref,
      channel,
      metadata:  { loanId },
    },
  });

  await createInAppNotification(
    memberId,
    'GENERAL',
    'Repayment submitted',
    `Your repayment of UGX ${amt.toLocaleString()} (ref: ${ref}) is pending admin approval.`
  );

  logger.info(`Repayment request queued: ${memberId} loan ${loanId} UGX ${amt} via ${channel}`);
  return { ok: true, data: row };
}

// ─── Member: submit savings deposit request ───────────────────────────────────
async function submitSavingsRequest(req, res, next) {
  try {
    const { memberId } = req.params;
    if (req.user.role === 'MEMBER' && memberId !== req.user.memberId) {
      return sendError(res, 403, 'You can only submit deposits for your own account.');
    }
    const { amount, channel = 'MOBILE_APP' } = req.body;
    const result = await createSavingsDepositRequest(memberId, amount, channel);
    if (!result.ok) return sendError(res, result.status, result.message);
    return sendSuccess(res, result.data, 'Savings deposit submitted for admin approval.', 201);
  } catch (err) {
    next(err);
  }
}

// ─── Member: submit loan repayment request ────────────────────────────────────
async function submitRepaymentRequest(req, res, next) {
  try {
    const { loanId } = req.params;
    const { amount, channel = 'MOBILE_APP' } = req.body;

    let loan;
    try {
      loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
    } catch {
      return sendError(res, 404, 'Loan not found.');
    }

    if (req.user.role === 'MEMBER' && loan.memberId !== req.user.memberId) {
      return sendError(res, 403, 'You can only repay your own loans.');
    }

    const reference = req.body.reference || buildReference('REPAY', channel);
    const result = await createLoanRepaymentRequest(loan.memberId, loanId, amount, channel, reference);
    if (!result.ok) return sendError(res, result.status, result.message);
    return sendSuccess(res, result.data, 'Repayment submitted for admin approval.', 201);
  } catch (err) {
    next(err);
  }
}

// ─── USSD internal: savings deposit request ───────────────────────────────────
async function ussdSubmitSavingsRequest(req, res, next) {
  try {
    const { memberId, amount, reference } = req.body;
    const result = await createSavingsDepositRequest(memberId, amount, 'USSD', reference);
    if (!result.ok) return sendError(res, result.status, result.message);
    return sendSuccess(res, result.data, 'Savings deposit submitted for admin approval.', 201);
  } catch (err) {
    next(err);
  }
}

// ─── USSD internal: repayment request ─────────────────────────────────────────
async function ussdSubmitRepaymentRequest(req, res, next) {
  try {
    const { loanId } = req.params;
    const { memberId, amount, reference } = req.body;

    const result = await createLoanRepaymentRequest(memberId, loanId, amount, 'USSD', reference);
    if (!result.ok) return sendError(res, result.status, result.message);
    return sendSuccess(res, result.data, 'Repayment submitted for admin approval.', 201);
  } catch (err) {
    next(err);
  }
}

// ─── Admin: list pending requests ─────────────────────────────────────────────
async function listRequests(req, res, next) {
  try {
    const statusRaw = (req.query.status || 'PENDING').toUpperCase();
    const type      = req.query.type ? String(req.query.type).toUpperCase() : undefined;

    const where = {};
    if (statusRaw !== 'ALL') where.status = statusRaw;
    if (type) where.type = type;

    const rows = await prisma.memberRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const memberIds = [...new Set(rows.map((r) => r.memberId))];
    const users = await prisma.user.findMany({
      where:  { memberId: { in: memberIds } },
      select: { memberId: true, fullName: true, phone: true },
    });
    const byId = new Map(users.map((u) => [u.memberId, u]));

    const enriched = rows.map((r) => ({
      ...r,
      fullName: byId.get(r.memberId)?.fullName || null,
      phone:    byId.get(r.memberId)?.phone || null,
    }));

    return sendSuccess(res, enriched);
  } catch (err) {
    next(err);
  }
}

// ─── Admin: approve request → write to blockchain ─────────────────────────────
async function approveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const row = await prisma.memberRequest.findUnique({ where: { id } });
    if (!row) return sendError(res, 404, 'Request not found.');
    if (row.status !== 'PENDING') return sendError(res, 400, `Request is already ${row.status}.`);

    let blockchainResult;

    if (row.type === 'SAVINGS_DEPOSIT') {
      blockchainResult = await fabricService.SavingsContract.submit(
        'deposit', row.memberId, String(row.amount), row.reference
      );
      await createInAppNotification(
        row.memberId,
        'DEPOSIT',
        'Deposit approved',
        `UGX ${row.amount.toLocaleString()} was credited to your savings (ref: ${row.reference}).`
      );
    } else if (row.type === 'LOAN_REPAYMENT') {
      const loanId = row.metadata?.loanId;
      if (!loanId) return sendError(res, 400, 'Repayment request is missing loan ID.');

      blockchainResult = await fabricService.LoansContract.submit(
        'repayLoan', loanId, String(row.amount), row.reference, row.channel
      );

      const msg = blockchainResult.isFullyRepaid
        ? 'Congratulations! Your loan has been fully repaid.'
        : `Repayment of UGX ${row.amount.toLocaleString()} approved. Outstanding: UGX ${blockchainResult.outstanding.toLocaleString()}`;

      await createInAppNotification(row.memberId, 'LOAN_REPAYMENT', 'Repayment approved', msg);
    } else {
      return sendError(res, 400, 'Unknown request type.');
    }

    const updated = await prisma.memberRequest.update({
      where: { id },
      data: {
        status:     'APPROVED',
        reviewedBy: req.user?.email || req.user?.memberId || 'admin',
        reviewedAt: new Date(),
      },
    });

    return sendSuccess(res, { request: updated, blockchain: blockchainResult }, 'Request approved and recorded on blockchain.');
  } catch (err) {
    next(err);
  }
}

// ─── Admin: reject request ────────────────────────────────────────────────────
async function rejectRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const row = await prisma.memberRequest.findUnique({ where: { id } });
    if (!row) return sendError(res, 404, 'Request not found.');
    if (row.status !== 'PENDING') return sendError(res, 400, `Request is already ${row.status}.`);

    const updated = await prisma.memberRequest.update({
      where: { id },
      data: {
        status:       'REJECTED',
        rejectReason: reason,
        reviewedBy:   req.user?.email || req.user?.memberId || 'admin',
        reviewedAt:   new Date(),
      },
    });

    const label = row.type === 'SAVINGS_DEPOSIT' ? 'Savings deposit' : 'Repayment';
    await createInAppNotification(
      row.memberId,
      'GENERAL',
      `${label} not approved`,
      `Your ${label.toLowerCase()} request (ref: ${row.reference}) was not approved. Reason: ${reason}`
    );

    return sendSuccess(res, updated, 'Request rejected.');
  } catch (err) {
    next(err);
  }
}

const savingsRequestValidators = [
  param('memberId').notEmpty(),
  body('amount').isFloat({ min: MIN_SAVINGS, max: MAX_SAVINGS }).withMessage(`Amount must be between UGX ${MIN_SAVINGS.toLocaleString()} and UGX ${MAX_SAVINGS.toLocaleString()}.`),
  body('channel').optional().isIn(['USSD', 'MOBILE_APP']),
];

const repaymentRequestValidators = [
  param('loanId').notEmpty(),
  body('amount').isFloat({ min: 1 }).withMessage('Repayment amount must be positive.'),
  body('channel').optional().isIn(['USSD', 'MOBILE_APP']),
  body('reference').optional().isString(),
];

const ussdSavingsValidators = [
  body('memberId').notEmpty(),
  body('amount').isFloat({ min: MIN_SAVINGS, max: MAX_SAVINGS }),
  body('reference').optional().isString(),
];

const ussdRepayValidators = [
  param('loanId').notEmpty(),
  body('memberId').notEmpty(),
  body('amount').isFloat({ min: 1 }),
  body('reference').optional().isString(),
];

const rejectValidators = [
  param('id').notEmpty(),
  body('reason').isLength({ min: 5 }).withMessage('Rejection reason must be at least 5 characters.'),
];

const listValidators = [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'ALL', 'pending', 'approved', 'rejected', 'all']),
  query('type').optional().isIn(['SAVINGS_DEPOSIT', 'LOAN_REPAYMENT', 'savings_deposit', 'loan_repayment']),
];

module.exports = {
  submitSavingsRequest,
  submitRepaymentRequest,
  ussdSubmitSavingsRequest,
  ussdSubmitRepaymentRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  savingsRequestValidators,
  repaymentRequestValidators,
  ussdSavingsValidators,
  ussdRepayValidators,
  rejectValidators,
  listValidators,
  createSavingsDepositRequest,
  createLoanRepaymentRequest,
};
