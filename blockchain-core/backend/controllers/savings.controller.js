// =============================================================================
// TrustLedger - Savings Controller
// SACCO-wide savings accounts and deposit/withdrawal activity.
// =============================================================================

'use strict';

const config = require('../config');
const logger = require('../config/logger');
const fabricService = require('../services/fabric.service');
const { getMergedMembers } = require('../services/members-list.service');
const { sendSuccess } = require('../utils/response');

const SAVINGS_TX_TYPES = new Set(['DEPOSIT', 'WITHDRAWAL']);

function computeStatsFromAccounts(accounts) {
  const list = Array.isArray(accounts) ? accounts : [];
  const totalBalance = list.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  return {
    totalBalance,
    accountCount:   list.length,
    averageBalance: list.length > 0 ? Math.round(totalBalance / list.length) : 0,
  };
}

/**
 * GET /api/v1/savings
 * Admin / Auditor. All ledger savings accounts + recent deposit/withdrawal txs.
 */
async function getSavingsOverview(req, res, next) {
  try {
    let accounts = [];

    if (config.fabric.enabled) {
      try {
        const raw = await fabricService.SavingsContract.evaluate('getAllSavingsAccounts');
        accounts = Array.isArray(raw) ? raw : [];
      } catch (err) {
        logger.warn(`Fabric getAllSavingsAccounts unavailable: ${err.message}`);
      }
    }

    const members = await getMergedMembers();
    const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

    const enrichedAccounts = accounts.map((a) => ({
      memberId:           a.memberId,
      fullName:           nameById.get(a.memberId) || null,
      balance:            Number(a.balance) || 0,
      totalDeposited:     Number(a.totalDeposited) || 0,
      totalWithdrawn:     Number(a.totalWithdrawn) || 0,
      transactionCount: Number(a.transactionCount) || 0,
      updatedAt:          a.updatedAt || null,
    }));

    let transactions = [];
    if (config.fabric.enabled) {
      try {
        const raw = await fabricService.LedgerContract.evaluate(
          'getAllTransactions', '', '100'
        );
        const txs = Array.isArray(raw) ? raw : [];
        transactions = txs
          .filter((t) => t && SAVINGS_TX_TYPES.has(t.type))
          .sort((a, b) =>
            String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
          );
      } catch (err) {
        logger.warn(`Fabric getAllTransactions unavailable: ${err.message}`);
      }
    }

    for (const tx of transactions) {
      if (tx.memberId && !tx.memberName) {
        tx.memberName = nameById.get(tx.memberId) || null;
      }
    }

    return sendSuccess(res, {
      stats: computeStatsFromAccounts(enrichedAccounts),
      accounts: enrichedAccounts,
      transactions,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSavingsOverview,
};
