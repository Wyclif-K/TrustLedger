// =============================================================================
// TrustLedger - Loans Controller
// Handles the full loan lifecycle via the Fabric LoansContract chaincode.
// =============================================================================

'use strict';

const { body, param } = require('express-validator');
const fabricService = require('../services/fabric.service');
const prisma = require('../services/db.service');
const config = require('../config');
const { createInAppNotification } = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/response');

function isLedgerMissingError(err) {
  const msg = String(err.message || '');
  return /No record|not found|does not exist/i.test(msg);
}

function isFabricTransportReadError(err) {
  const msg = String(err.message || '');
  return (
    /UNAVAILABLE|ECONNREFUSED|No connection established|Connection refused/i.test(msg) ||
    /DEADLINE_EXCEEDED|dns\s*error|Name resolution failed/i.test(msg)
  );
}

function isLedgerMissingOrFabricDown(err) {
  return isLedgerMissingError(err) || isFabricTransportReadError(err);
}

// ─── Apply for Loan ───────────────────────────────────────────────────────────
/**
 * POST /api/v1/loans
 * Member applies for a loan (or admin on their behalf).
 */
async function applyForLoan(req, res, next) {
  try {
    const { memberId, amount, termMonths, purpose } = req.body;

    if (req.user.role === 'MEMBER' && memberId !== req.user.memberId) {
      return sendError(res, 403, 'You can only apply for loans on your own account.');
    }

    const result = await fabricService.LoansContract.submit(
      'applyForLoan',
      memberId, String(amount), String(termMonths), purpose
    );

    // Send notification
    await createInAppNotification(memberId, 'GENERAL',
      'Loan Application Submitted',
      `Your loan application for UGX ${Number(amount).toLocaleString()} has been submitted and is pending review.`
    );

    return sendSuccess(res, result, 'Loan application submitted successfully.', 201);
  } catch (err) {
    next(err);
  }
}

const applyValidators = [
  body('memberId').notEmpty().withMessage('Member ID required.'),
  body('amount').isFloat({ min: 100000 }).withMessage('Minimum loan amount is UGX 100,000.'),
  body('termMonths').isInt({ min: 1, max: 24 }).withMessage('Term must be between 1 and 24 months.'),
  body('purpose').isLength({ min: 5 }).withMessage('Purpose must be at least 5 characters.'),
  body('guarantorId').optional().isString(),
];

// ─── Get All Loans ────────────────────────────────────────────────────────────
/**
 * GET /api/v1/loans
 * Admin / Auditor: all loans. Supports ?status= filter.
 */
async function getAllLoans(req, res, next) {
  try {
    const raw = req.query.status;
    const statusFilter =
      raw == null || String(raw).trim() === '' ? 'ALL' : String(raw).trim().toUpperCase();

    // Full loan documents from chain state (status, term, balances, dates).
    // Do not use getAllTransactions(LOAN_APPLY) here — those rows are tx stubs, not loans.
    const loans = await fabricService.LoansContract.evaluate('getAllLoans', statusFilter);

    return sendSuccess(res, Array.isArray(loans) ? loans : []);
  } catch (err) {
    next(err);
  }
}

// ─── Get Loan ─────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/loans/:loanId
 */
async function getLoan(req, res, next) {
  try {
    const loan = await fabricService.LoansContract.evaluate('getLoan', req.params.loanId);
    return sendSuccess(res, loan);
  } catch (err) {
    next(err);
  }
}

// ─── Get Member Loans ─────────────────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId/loans
 */
async function getMemberLoans(req, res, next) {
  try {
    const { memberId } = req.params;

    if (config.fabric.enabled) {
      try {
        const loans = await fabricService.LoansContract.evaluate('getMemberLoans', memberId);
        return sendSuccess(res, Array.isArray(loans) ? loans : []);
      } catch (err) {
        if (!isLedgerMissingOrFabricDown(err)) return next(err);
      }
    }

    const user = await prisma.user.findUnique({ where: { memberId } });
    if (!user) return sendError(res, 404, 'Member not found.');
    return sendSuccess(res, []);
  } catch (err) {
    next(err);
  }
}

// ─── Approve Loan ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/loans/:loanId/approve
 * Admin only.
 */
async function approveLoan(req, res, next) {
  try {
    const { loanId } = req.params;
    const { remarks = '' } = req.body;

    const result = await fabricService.LoansContract.submit('approveLoan', loanId, remarks);

    // Notify member
    const loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
    await createInAppNotification(loan.memberId, 'LOAN_APPROVED',
      'Loan Approved!',
      `Your loan of UGX ${loan.amount.toLocaleString()} has been approved. Await disbursement.`
    );

    return sendSuccess(res, result, 'Loan approved successfully.');
  } catch (err) {
    next(err);
  }
}

// ─── Reject Loan ──────────────────────────────────────────────────────────────
/**
 * POST /api/v1/loans/:loanId/reject
 * Admin only.
 */
async function rejectLoan(req, res, next) {
  try {
    const { loanId } = req.params;
    const { reason } = req.body;

    const result = await fabricService.LoansContract.submit('rejectLoan', loanId, reason);

    const loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
    await createInAppNotification(loan.memberId, 'LOAN_REJECTED',
      'Loan Application Rejected',
      `Unfortunately, your loan application has been rejected. Reason: ${reason}`
    );

    return sendSuccess(res, result, 'Loan rejected.');
  } catch (err) {
    next(err);
  }
}

const rejectValidators = [
  param('loanId').notEmpty(),
  body('reason').isLength({ min: 5 }).withMessage('Rejection reason must be at least 5 characters.'),
];

// ─── Disburse Loan ────────────────────────────────────────────────────────────
/**
 * POST /api/v1/loans/:loanId/disburse
 * Admin only.
 */
async function disburseLoan(req, res, next) {
  try {
    const { loanId } = req.params;
    const { disbursementRef } = req.body;

    const result = await fabricService.LoansContract.submit(
      'disburseLoan', loanId, disbursementRef
    );

    const loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
    await createInAppNotification(loan.memberId, 'LOAN_DISBURSED',
      'Loan Disbursed',
      `UGX ${loan.amount.toLocaleString()} has been disbursed. First repayment due: ${result.nextDueDate?.split('T')[0]}`
    );

    return sendSuccess(res, result, 'Loan disbursed successfully.');
  } catch (err) {
    next(err);
  }
}

const disburseValidators = [
  param('loanId').notEmpty(),
  body('disbursementRef').notEmpty().withMessage('Disbursement reference required.'),
];

// ─── Repay Loan ───────────────────────────────────────────────────────────────
/**
 * POST /api/v1/loans/:loanId/repay
 */
async function repayLoan(req, res, next) {
  try {
    const { loanId } = req.params;
    const { amount, reference, channel = 'TELLER' } = req.body;

    const result = await fabricService.LoansContract.submit(
      'repayLoan', loanId, String(amount), reference, channel
    );

    const loan = await fabricService.LoansContract.evaluate('getLoan', loanId);
    const msg = result.isFullyRepaid
      ? `Congratulations! Your loan has been fully repaid.`
      : `Repayment of UGX ${Number(amount).toLocaleString()} received. Outstanding: UGX ${result.outstanding.toLocaleString()}`;

    await createInAppNotification(loan.memberId, 'LOAN_REPAYMENT', 'Loan Repayment Received', msg);

    return sendSuccess(res, result, 'Repayment recorded successfully.');
  } catch (err) {
    next(err);
  }
}

const repayValidators = [
  param('loanId').notEmpty(),
  body('amount').isFloat({ min: 1 }).withMessage('Repayment amount must be positive.'),
  body('reference').notEmpty().withMessage('Payment reference required.'),
];

// ─── Get Loan Repayments ──────────────────────────────────────────────────────
/**
 * GET /api/v1/loans/:loanId/repayments
 */
async function getLoanRepayments(req, res, next) {
  try {
    const repayments = await fabricService.LoansContract.evaluate(
      'getLoanRepayments', req.params.loanId
    );
    return sendSuccess(res, repayments);
  } catch (err) {
    next(err);
  }
}

// ─── Get Loan History (Audit) ─────────────────────────────────────────────────
/**
 * GET /api/v1/loans/:loanId/history
 */
async function getLoanHistory(req, res, next) {
  try {
    const history = await fabricService.LoansContract.evaluate(
      'getLoanHistory', req.params.loanId
    );
    return sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
}

// ─── Get Loan Policy ──────────────────────────────────────────────────────────
/**
 * GET /api/v1/loans/policy
 * Public — used by the app to display SACCO rules.
 */
async function getLoanPolicy(req, res, next) {
  try {
    const policy = await fabricService.LoansContract.evaluate('getLoanPolicy');
    return sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  applyForLoan,
  applyValidators,
  getAllLoans,
  getLoan,
  getMemberLoans,
  approveLoan,
  rejectLoan,
  rejectValidators,
  disburseLoan,
  disburseValidators,
  repayLoan,
  repayValidators,
  getLoanRepayments,
  getLoanHistory,
  getLoanPolicy,
};
