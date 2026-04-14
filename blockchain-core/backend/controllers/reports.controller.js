// =============================================================================
// TrustLedger - Reports & Dashboard Controller
// SACCO-wide statistics, date-range reports, audit trails.
// =============================================================================

'use strict';

const { query } = require('express-validator');
const config = require('../config');
const logger = require('../config/logger');
const fabricService = require('../services/fabric.service');
const { getMergedMembers, memberCountsFromList } = require('../services/members-list.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Fabric chaincode `getTransactionsByDateRange` is invoked with exactly two args (from, to).
 * Optional type filtering is applied here so the peer does not reject extra parameters.
 */
function filterDateRangeReportByType(report, txType) {
  const t = String(txType || '').trim();
  if (!t || !report || typeof report !== 'object') return report;

  const txs = Array.isArray(report.transactions) ? report.transactions : [];
  const filtered = txs.filter((x) => x && x.type === t);
  const totals = filtered.reduce((acc, tx) => {
    acc[tx.type] = (acc[tx.type] || 0) + Number(tx.amount || 0);
    return acc;
  }, {});

  return {
    ...report,
    transactionCount: filtered.length,
    totals,
    transactions: filtered,
  };
}

function emptySaccoStats() {
  return {
    members: { total: 0, active: 0, suspended: 0 },
    savings: {
      totalBalance:   0,
      accountCount:   0,
      averageBalance: 0,
    },
    loans: {
      total:             0,
      pending:           0,
      disbursed:         0,
      repaid:            0,
      totalDisbursed:    0,
      totalOutstanding:  0,
      totalPendingValue: 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
/**
 * GET /api/v1/reports/dashboard
 * Admin / Auditor. SACCO stats from the ledger; member counts include PostgreSQL MEMBER users.
 */
async function getDashboardStats(req, res, next) {
  try {
    const base = emptySaccoStats();
    let chain = {};
    if (config.fabric.enabled) {
      try {
        const raw = await fabricService.LedgerContract.evaluate('getSaccoStats');
        if (raw && typeof raw === 'object') chain = raw;
      } catch (err) {
        logger.warn(`Fabric getSaccoStats unavailable: ${err.message}`);
      }
    }

    const stats = {
      ...base,
      ...chain,
      savings: { ...base.savings, ...(chain.savings || {}) },
      loans:   { ...base.loans, ...(chain.loans || {}) },
    };

    const merged = await getMergedMembers();
    stats.members = memberCountsFromList(merged);
    stats.generatedAt = new Date().toISOString();

    return sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

// ─── All Transactions ─────────────────────────────────────────────────────────
/**
 * GET /api/v1/reports/transactions?type=DEPOSIT&limit=100
 */
async function getAllTransactions(req, res, next) {
  try {
    const { type = null, limit = 100 } = req.query;

    const txs = await fabricService.LedgerContract.evaluate(
      'getAllTransactions', type || '', String(limit)
    );
    return sendSuccess(res, Array.isArray(txs) ? txs : []);
  } catch (err) {
    next(err);
  }
}

// ─── Date Range Report ────────────────────────────────────────────────────────
/**
 * GET /api/v1/reports/range?from=2024-01-01&to=2024-01-31&type=DEPOSIT
 */
async function getDateRangeReport(req, res, next) {
  try {
    const { from, to, type = null } = req.query;

    if (!from || !to) return sendError(res, 400, 'from and to date parameters are required.');

    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to + 'T23:59:59').toISOString();

    const report = await fabricService.LedgerContract.evaluate(
      'getTransactionsByDateRange',
      fromIso,
      toIso
    );
    return sendSuccess(res, filterDateRangeReportByType(report, type));
  } catch (err) {
    next(err);
  }
}

const dateRangeValidators = [
  query('from').notEmpty().withMessage('from is required.')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('from must be YYYY-MM-DD.'),
  query('to').notEmpty().withMessage('to is required.')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('to must be YYYY-MM-DD.'),
];

// ─── Pending Loans Report ─────────────────────────────────────────────────────
/**
 * GET /api/v1/reports/pending-loans
 */
async function getPendingLoans(req, res, next) {
  try {
    const loans = await fabricService.LoansContract.evaluate('getPendingLoans');
    return sendSuccess(res, Array.isArray(loans) ? loans : []);
  } catch (err) {
    next(err);
  }
}

// ─── Single Transaction ───────────────────────────────────────────────────────
/**
 * GET /api/v1/reports/transactions/:txId
 */
async function getTransaction(req, res, next) {
  try {
    const tx = await fabricService.LedgerContract.evaluate('getTransaction', req.params.txId);
    return sendSuccess(res, tx);
  } catch (err) {
    next(err);
  }
}

// ─── Monthly trends (dashboard chart) ─────────────────────────────────────────
/**
 * GET /api/v1/reports/monthly-trends?months=7
 * Aggregates DEPOSIT vs loan activity (LOAN_DISBURSE + LOAN_REPAY) per calendar month from the ledger.
 */
function buildMonthlyTrendsPayload(months, report) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1, 0, 0, 0, 0);

  const txs = Array.isArray(report?.transactions) ? report.transactions : [];
  const bucket = new Map();

  const monthSlots = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthSlots.push({
      key,
      month: d.toLocaleString('en-US', { month: 'short' }),
    });
    bucket.set(key, { deposits: 0, loans: 0 });
  }

  for (const tx of txs) {
    if (!tx.timestamp) continue;
    const d = new Date(tx.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!bucket.has(key)) continue;
    const b = bucket.get(key);
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'DEPOSIT') b.deposits += amt;
    if (tx.type === 'LOAN_DISBURSE' || tx.type === 'LOAN_REPAY') b.loans += amt;
  }

  const series = monthSlots.map((s) => ({
    month:    s.month,
    monthKey: s.key,
    deposits: bucket.get(s.key).deposits,
    loans:    bucket.get(s.key).loans,
  }));

  return {
    series,
    fromDate: start.toISOString(),
    toDate:   end.toISOString(),
  };
}

async function getMonthlyTrends(req, res, next) {
  try {
    let months = parseInt(req.query.months, 10);
    if (Number.isNaN(months) || months < 1) months = 7;
    if (months > 24) months = 24;

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1, 0, 0, 0, 0);

    const report = await fabricService.LedgerContract.evaluate(
      'getTransactionsByDateRange',
      start.toISOString(),
      end.toISOString()
    );
    return sendSuccess(res, buildMonthlyTrendsPayload(months, report));
  } catch (err) {
    next(err);
  }
}

const monthlyTrendsValidators = [
  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('months must be between 1 and 24.'),
];

module.exports = {
  getDashboardStats,
  getAllTransactions,
  getDateRangeReport,
  dateRangeValidators,
  getPendingLoans,
  getTransaction,
  getMonthlyTrends,
  monthlyTrendsValidators,
};
