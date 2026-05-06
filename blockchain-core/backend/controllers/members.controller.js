// =============================================================================
// TrustLedger - Members Controller
// Handles: member profiles, balance queries, transaction history, status updates
// =============================================================================

'use strict';

/**
 * Pack ref+reason (+ optional [CHANNEL] prefix) for SavingsContract.withdraw (3 Fabric args).
 * Must match chaincode LEDGER_WITHDRAW_SEP and parseDepositReference channel prefix.
 */
const LEDGER_WITHDRAW_SEP = '|||!TLW!|||';

const { body, param } = require('express-validator');
const config = require('../config');
const fabricService = require('../services/fabric.service');
const prisma        = require('../services/db.service');
const { createInAppNotification, notifySavingsBySms } = require('../services/notification.service');
const { getMergedMembers } = require('../services/members-list.service');
const { sendSuccess, sendError } = require('../utils/response');

function isLedgerMissingError(err) {
  const msg = String(err.message || '');
  return /No record|not found|does not exist/i.test(msg);
}

/** Peer unreachable / gRPC transport — prefer DB fallback for member self-service reads instead of 503. */
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

function userToMemberProfile(user) {
  return {
    docType: 'member',
    memberId: user.memberId,
    fullName: user.fullName,
    phone: user.phone,
    nationalId: user.nationalId,
    email: user.email,
    role: String(user.role || 'MEMBER').toLowerCase(),
    status: user.status,
    registeredBy: null,
    registeredAt: user.createdAt ? user.createdAt.toISOString() : null,
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    ledgerSynced: false,
  };
}

// ─── Validators ───────────────────────────────────────────────────────────────
const statusUpdateValidators = [
  param('memberId').notEmpty(),
  body('status').isIn(['ACTIVE', 'SUSPENDED', 'CLOSED']).withMessage('Invalid status.'),
  body('reason').notEmpty().withMessage('Reason for status change is required.'),
];

// ─── Get All Members ──────────────────────────────────────────────────────────
/**
 * GET /api/v1/members
 * Admin / Auditor. Ledger + PostgreSQL MEMBER users (union by memberId).
 */
async function getAllMembers(req, res, next) {
  try {
    const members = await getMergedMembers();
    return sendSuccess(res, members);
  } catch (err) {
    next(err);
  }
}

// ─── Get Single Member ────────────────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId
 */
async function getMember(req, res, next) {
  try {
    const { memberId } = req.params;

    const user = await prisma.user.findUnique({ where: { memberId } });

    // If no off-chain user exists at all, prefer a clear 404 regardless of ledger state.
    if (!user && !config.fabric.enabled) {
      return sendError(res, 404, 'Member not found.');
    }

    let ledgerMember = null;

    if (config.fabric.enabled) {
      try {
        const member = await fabricService.SavingsContract.evaluate('getMember', memberId);
        if (member && typeof member === 'object' && member.memberId) {
          ledgerMember = member;
        }
      } catch (err) {
        if (!isLedgerMissingOrFabricDown(err)) return next(err);
      }
    }

    if (!user && !ledgerMember) {
      return sendError(res, 404, 'Member not found.');
    }

    // Base profile from DB user (email, lastLoginAt, etc.) when available
    const baseProfile = user ? userToMemberProfile(user) : {};

    // Merge with ledger member when available; ledger status/role/registeredBy take precedence,
    // while email/lastLoginAt remain from the user profile.
    let merged = {
      ...baseProfile,
      ...ledgerMember,
      email: baseProfile.email || ledgerMember?.email,
      lastLoginAt: baseProfile.lastLoginAt || ledgerMember?.lastLoginAt || null,
    };

    // Derive a human-friendly "registeredByDisplay" from the Fabric X.509 subject when possible.
    if (ledgerMember && ledgerMember.registeredBy) {
      const raw = String(ledgerMember.registeredBy);
      let display = raw;

      // Extract CN from DN string: .../CN=Admin@sacco.trustledger.com/...
      const cnMatch = raw.match(/CN=([^/]+)/);
      const cn = cnMatch ? cnMatch[1] : null;

      if (cn) {
        // Try to resolve CN as an email in the users table to get fullName.
        const registeringUser = await prisma.user.findUnique({ where: { email: cn } }).catch(() => null);
        if (registeringUser) {
          display = registeringUser.fullName || registeringUser.email || cn;
        } else {
          display = cn;
        }
      }

      merged = {
        ...merged,
        registeredByDisplay: display,
      };
    }

    return sendSuccess(res, merged);
  } catch (err) {
    next(err);
  }
}

// ─── Get Balance ──────────────────────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId/balance
 */
async function getBalance(req, res, next) {
  try {
    const { memberId } = req.params;

    if (config.fabric.enabled) {
      try {
        const balance = await fabricService.SavingsContract.evaluate('getBalance', memberId);
        return sendSuccess(res, {
          ...balance,
          balance:        Number(balance.balance) || 0,
          totalDeposited: Number(balance.totalDeposited) || 0,
          totalWithdrawn: Number(balance.totalWithdrawn) || 0,
        });
      } catch (err) {
        if (!isLedgerMissingOrFabricDown(err)) return next(err);
      }
    }

    const user = await prisma.user.findUnique({ where: { memberId } });
    if (!user) return sendError(res, 404, 'Member not found.');
    return sendSuccess(res, {
      memberId,
      balance:        0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      updatedAt:      null,
      offLedger:      true,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get Transactions ─────────────────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId/transactions
 */
async function getTransactions(req, res, next) {
  try {
    const { memberId } = req.params;

    if (config.fabric.enabled) {
      try {
        const txs = await fabricService.SavingsContract.evaluate(
          'getMemberTransactions', memberId
        );
        return sendSuccess(res, Array.isArray(txs) ? txs : []);
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

// ─── Get Savings History (Audit) ──────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId/savings-history
 * Admin / Auditor only. Returns full immutable history.
 */
async function getSavingsHistory(req, res, next) {
  try {
    const { memberId } = req.params;

    if (config.fabric.enabled) {
      try {
        const history = await fabricService.SavingsContract.evaluate(
          'getSavingsHistory', memberId
        );
        return sendSuccess(res, history);
      } catch (err) {
        if (!isLedgerMissingError(err)) return next(err);
      }
    }

    const user = await prisma.user.findUnique({ where: { memberId } });
    if (!user) return sendError(res, 404, 'Member not found.');
    return sendSuccess(res, []);
  } catch (err) {
    next(err);
  }
}

// ─── Deposit ──────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/members/:memberId/deposit
 * Admin only (teller-initiated deposit).
 */
async function deposit(req, res, next) {
  try {
    const { memberId } = req.params;
    const { amount, reference, channel = 'TELLER' } = req.body;

    const ledgerReference =
      channel && channel !== 'TELLER' ? `[${channel}] ${reference}` : reference;

    const result = await fabricService.SavingsContract.submit(
      'deposit', memberId, String(amount), ledgerReference
    );
    const amt = Number(amount) || 0;
    await createInAppNotification(
      memberId,
      'DEPOSIT',
      'Deposit received',
      `UGX ${amt.toLocaleString()} was credited to your savings (ref: ${reference}).`
    );
    void notifySavingsBySms(
      memberId,
      `TrustLedger SACCO: UGX ${amt.toLocaleString()} deposited to your savings. Ref: ${reference}.`
    );
    return sendSuccess(res, result, 'Deposit recorded successfully.');
  } catch (err) {
    next(err);
  }
}

const depositValidators = [
  param('memberId').notEmpty(),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number.'),
  body('reference').notEmpty().withMessage('Payment reference required.'),
  body('channel').optional().isIn(['TELLER', 'MOBILE_APP', 'USSD', 'BANK_TRANSFER']),
];

// ─── Withdraw ─────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/members/:memberId/withdraw
 * Admin only.
 */
async function withdraw(req, res, next) {
  try {
    const { memberId } = req.params;
    const { amount, reference, reason, channel = 'TELLER' } = req.body;

    const innerPacked = `${reference}${LEDGER_WITHDRAW_SEP}${reason}`;
    const ledgerPacked =
      channel && channel !== 'TELLER' ? `[${channel}] ${innerPacked}` : innerPacked;

    const result = await fabricService.SavingsContract.submit(
      'withdraw', memberId, String(amount), ledgerPacked
    );
    const amt = Number(amount) || 0;
    await createInAppNotification(
      memberId,
      'WITHDRAWAL',
      'Withdrawal processed',
      `UGX ${amt.toLocaleString()} was debited from your savings (ref: ${reference}).`
    );
    void notifySavingsBySms(
      memberId,
      `TrustLedger SACCO: UGX ${amt.toLocaleString()} withdrawn from savings. Ref: ${reference}.`
    );
    return sendSuccess(res, result, 'Withdrawal recorded successfully.');
  } catch (err) {
    next(err);
  }
}

const withdrawValidators = [
  param('memberId').notEmpty(),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number.'),
  body('reference').notEmpty().withMessage('Reference required.'),
  body('reason').notEmpty().withMessage('Reason for withdrawal is required.'),
  body('channel').optional().isIn(['TELLER', 'MOBILE_APP', 'USSD', 'BANK_TRANSFER']),
];

// ─── Update Member Status ─────────────────────────────────────────────────────
/**
 * PATCH /api/v1/members/:memberId/status
 * Admin only. Suspend or reactivate a member.
 */
async function updateStatus(req, res, next) {
  try {
    const { memberId } = req.params;
    const { status, reason } = req.body;

    await fabricService.SavingsContract.submit(
      'updateMemberStatus', memberId, status, reason
    );

    await prisma.user.update({
      where: { memberId },
      data:  { status },
    });

    return sendSuccess(res, { memberId, status, reason }, `Member status updated to ${status}.`);
  } catch (err) {
    next(err);
  }
}

// ─── Verify Balance (Audit) ───────────────────────────────────────────────────
/**
 * GET /api/v1/members/:memberId/verify-balance
 * Runs ledger integrity check for a member.
 */
async function verifyBalance(req, res, next) {
  try {
    const result = await fabricService.LedgerContract.evaluate(
      'verifyMemberBalance', req.params.memberId
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/members/:memberId/purge-ledger
 * SUPER_ADMIN only. Removes MEMBER + SAVINGS on chain so the ID can be re-registered.
 */
async function purgeLedgerMemberRecord(req, res, next) {
  try {
    if (!config.fabric.enabled) {
      return sendError(res, 503, 'Hyperledger Fabric is disabled.');
    }
    if (!config.ledger.allowMemberPurge) {
      return sendError(
        res,
        403,
        'Ledger purge is disabled. Set ALLOW_LEDGER_MEMBER_PURGE=true in .env, restart the API, ' +
          'and redeploy chaincode with purgeLedgerMember.'
      );
    }
    const { memberId } = req.params;
    const result = await fabricService.SavingsContract.submit('purgeLedgerMember', memberId);
    return sendSuccess(res, result, 'Ledger member record purged.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllMembers,
  getMember,
  getBalance,
  getTransactions,
  getSavingsHistory,
  deposit,
  depositValidators,
  withdraw,
  withdrawValidators,
  updateStatus,
  statusUpdateValidators,
  verifyBalance,
  purgeLedgerMemberRecord,
};
