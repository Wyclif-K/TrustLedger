// =============================================================================
// TrustLedger - Ledger Contract
// Cross-cutting queries: reports, audit trail, SACCO-wide stats, USSD reads
// =============================================================================

'use strict';

const { Contract } = require('fabric-contract-api');
const {
  KeyPrefix,
  buildKey,
  requireRole,
  getState,
  richQuery,
} = require('./common/utils');

class LedgerContract extends Contract {

  constructor() {
    super('LedgerContract');
  }

  async initLedger(ctx) {
    // Seed a SACCO metadata record on first deploy
    const metaKey = 'SACCO:META';
    await ctx.stub.putState(metaKey, Buffer.from(JSON.stringify({
      docType:        'sacco_meta',
      name:           'TrustLedger SACCO',
      version:        '1.0.0',
      currency:       'UGX',
      country:        'Uganda',
      initializedAt:  new Date().toISOString(),
    })));
    return { success: true, message: 'LedgerContract initialized' };
  }

  // ─── USSD: Quick Balance (optimized for USSD response speed) ──────────────
  /**
   * Minimal balance response formatted for USSD (short, fast).
   * Used by the USSD bridge to respond to *234# requests.
   */
  async getUssdBalance(ctx, memberId) {
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);

    // Get active loan outstanding if any
    const loans = await richQuery(ctx, {
      selector: {
        docType:  'loan',
        memberId,
        status:   'DISBURSED',
      },
    });
    const activeLoan = loans[0] || null;

    return {
      memberId,
      balance:     savings.balance,
      loanBalance: activeLoan ? activeLoan.outstandingBalance : 0,
      nextDueDate: activeLoan ? activeLoan.nextDueDate : null,
      // Formatted for USSD display (80 char lines max)
      ussdText:    this._formatUssdBalance(savings, activeLoan),
    };
  }

  _formatUssdBalance(savings, activeLoan) {
    let text = `TrustLedger SACCO\n`;
    text += `Savings: UGX ${savings.balance.toLocaleString()}\n`;
    if (activeLoan) {
      text += `Loan due: UGX ${activeLoan.outstandingBalance.toLocaleString()}\n`;
      text += `Next pmt: ${activeLoan.nextDueDate ? activeLoan.nextDueDate.split('T')[0] : 'N/A'}`;
    } else {
      text += `No active loan`;
    }
    return text;
  }

  // ─── USSD: Mini Statement (last 5 transactions) ───────────────────────────
  async getUssdMiniStatement(ctx, memberId) {
    const transactions = (await richQuery(ctx, {
      selector: { docType: 'transaction', memberId },
    })).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

    const last5 = transactions.slice(0, 5);
    const lines = last5.map(tx => {
      const sign   = tx.type === 'DEPOSIT' ? '+' : '-';
      const amount = `${sign}${(tx.amount / 1000).toFixed(0)}K`;
      const date   = tx.timestamp.split('T')[0];
      return `${date} ${tx.type.substring(0, 4)} ${amount}`;
    });

    return {
      memberId,
      transactions: last5,
      ussdText: `TrustLedger Mini Stmt\n${lines.join('\n')}`,
    };
  }

  // ─── SACCO-Wide Statistics (Admin Dashboard) ──────────────────────────────
  /**
   * Aggregate statistics for the admin dashboard overview.
   */
  async getSaccoStats(ctx) {
    requireRole(ctx, 'admin', 'auditor');

    const [members, savings, allLoans] = await Promise.all([
      richQuery(ctx, { selector: { docType: 'member' } }),
      richQuery(ctx, { selector: { docType: 'savings' } }),
      richQuery(ctx, { selector: { docType: 'loan' } }),
    ]);

    const totalSavings    = savings.reduce((sum, s) => sum + s.balance, 0);
    const pendingLoans    = allLoans.filter(l => l.status === 'PENDING');
    const disbursedLoans  = allLoans.filter(l => l.status === 'DISBURSED');
    const repaidLoans     = allLoans.filter(l => l.status === 'REPAID');
    const totalDisbursed  = disbursedLoans.reduce((sum, l) => sum + l.amount, 0);
    const totalOutstanding = disbursedLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);

    return {
      members: {
        total:     members.length,
        active:    members.filter(m => m.status === 'ACTIVE').length,
        suspended: members.filter(m => m.status === 'SUSPENDED').length,
      },
      savings: {
        totalBalance:   totalSavings,
        accountCount:   savings.length,
        averageBalance: savings.length > 0 ? Math.round(totalSavings / savings.length) : 0,
      },
      loans: {
        total:         allLoans.length,
        pending:       pendingLoans.length,
        disbursed:     disbursedLoans.length,
        repaid:        repaidLoans.length,
        totalDisbursed,
        totalOutstanding,
        totalPendingValue: pendingLoans.reduce((sum, l) => sum + l.amount, 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── All Transactions (Audit / Report) ────────────────────────────────────
  async getAllTransactions(ctx, txType = null, limit = 100) {
    requireRole(ctx, 'admin', 'auditor');

    const selector = { docType: 'transaction' };
    if (txType) selector.type = txType;

    const n = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 5000);
    const txs = (await richQuery(ctx, { selector }))
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
      .slice(0, n);

    return txs;
  }

  // ─── Get Transaction By ID ────────────────────────────────────────────────
  async getTransaction(ctx, txId) {
    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    return await getState(ctx, txKey);
  }

  // ─── Verify Ledger Integrity ──────────────────────────────────────────────
  /**
   * For a given member, re-compute balance from all transactions and compare
   * against the stored balance. Used by auditors to verify no tampering.
   */
  async verifyMemberBalance(ctx, memberId) {
    requireRole(ctx, 'admin', 'auditor');

    const transactions = (await richQuery(ctx, {
      selector: {
        docType:  'transaction',
        memberId,
        type:     { $in: ['DEPOSIT', 'WITHDRAWAL'] },
      },
    })).sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

    let computedBalance = 0;
    for (const tx of transactions) {
      if (tx.type === 'DEPOSIT')    computedBalance += tx.amount;
      if (tx.type === 'WITHDRAWAL') computedBalance -= tx.amount;
    }

    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);

    const isBalanced = Math.abs(computedBalance - savings.balance) < 0.01;

    return {
      memberId,
      storedBalance:   savings.balance,
      computedBalance,
      isBalanced,
      discrepancy:     savings.balance - computedBalance,
      txCount:         transactions.length,
      verifiedAt:      new Date().toISOString(),
      status:          isBalanced ? 'VERIFIED' : 'DISCREPANCY_FOUND',
    };
  }

  // ─── Date Range Report ────────────────────────────────────────────────────
  /**
   * Get all transactions within a date range.
   * Used for monthly/quarterly reports.
   * Fabric invokes this with exactly two args after ctx (fromDate, toDate). Filter by type in the API if needed.
   */
  async getTransactionsByDateRange(ctx, fromDate, toDate) {
    requireRole(ctx, 'admin', 'auditor');

    const selector = {
      docType:   'transaction',
      timestamp: { $gte: fromDate, $lte: toDate },
    };

    const transactions = (await richQuery(ctx, { selector })).sort(
      (a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
    );

    const totals = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + tx.amount;
      return acc;
    }, {});

    return {
      fromDate,
      toDate,
      transactionCount: transactions.length,
      totals,
      transactions,
    };
  }
}

module.exports = LedgerContract;
