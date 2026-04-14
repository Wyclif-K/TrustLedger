// =============================================================================
// TrustLedger - Loans Contract
// Handles: loan applications, approval/rejection, disbursement, repayments
// =============================================================================

'use strict';

const { Contract } = require('fabric-contract-api');
const {
  TxType, LoanStatus, MemberStatus, KeyPrefix,
  buildKey, getTxTimestamp, getCallerIdentity,
  requireRole, assertPositiveAmount,
  getState, putState, stateExists,
  richQuery, getHistory,
} = require('./common/utils');

// SACCO Loan Policy Constants
const LOAN_POLICY = {
  MINIMUM_AMOUNT:         100000,    // UGX 100,000
  MAXIMUM_AMOUNT:        50000000,   // UGX 50,000,000
  MAX_MULTIPLIER:              3,    // Loan ≤ 3× savings balance
  INTEREST_RATE_MONTHLY:    0.015,   // 1.5% per month (flat)
  PROCESSING_FEE_RATE:      0.01,    // 1% of principal
  MAX_TERM_MONTHS:            24,    // 24 months maximum
  MIN_TERM_MONTHS:             1,
  MINIMUM_SAVINGS_AGE_DAYS:   90,    // Must have saved for 90 days
};

class LoansContract extends Contract {

  constructor() {
    super('LoansContract');
  }

  async initLedger(ctx) {
    console.log('LoansContract: Initialized for TrustLedger SACCO');
    return { success: true, message: 'LoansContract initialized' };
  }

  // ─── Apply for Loan ───────────────────────────────────────────────────────
  /**
   * A member submits a loan application.
   * The loan is created with PENDING status for admin review.
   * (Exactly four chaincode args after ctx — Fabric rejects extra parameters.)
   *
   * @param {string} memberId     - Applying member
   * @param {string} amount       - Requested loan amount (UGX)
   * @param {string} termMonths   - Repayment period in months
   * @param {string} purpose      - Purpose of the loan
   */
  async applyForLoan(ctx, memberId, amount, termMonths, purpose) {
    const guarantorId = '';
    requireRole(ctx, 'admin', 'member');

    const loanAmount = assertPositiveAmount(amount, 'Loan amount');
    const term = parseInt(termMonths);

    // ── Validate loan policy ──────────────────────────────────────────────
    if (loanAmount < LOAN_POLICY.MINIMUM_AMOUNT) {
      throw new Error(`Minimum loan amount is UGX ${LOAN_POLICY.MINIMUM_AMOUNT.toLocaleString()}.`);
    }
    if (loanAmount > LOAN_POLICY.MAXIMUM_AMOUNT) {
      throw new Error(`Maximum loan amount is UGX ${LOAN_POLICY.MAXIMUM_AMOUNT.toLocaleString()}.`);
    }
    if (term < LOAN_POLICY.MIN_TERM_MONTHS || term > LOAN_POLICY.MAX_TERM_MONTHS) {
      throw new Error(`Loan term must be between ${LOAN_POLICY.MIN_TERM_MONTHS} and ${LOAN_POLICY.MAX_TERM_MONTHS} months.`);
    }
    if (!purpose || purpose.trim().length < 5) {
      throw new Error('Loan purpose must be at least 5 characters.');
    }

    // ── Verify member is active ───────────────────────────────────────────
    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const member = await getState(ctx, memberKey);
    if (member.status !== MemberStatus.ACTIVE) {
      throw new Error(`Member '${memberId}' account is not active.`);
    }

    // ── Check savings vs loan multiplier ──────────────────────────────────
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);
    const savingsBalance = Number(savings.balance) || 0;
    const maxLoan = savingsBalance * LOAN_POLICY.MAX_MULTIPLIER;
    if (loanAmount > maxLoan) {
      if (savingsBalance <= 0) {
        throw new Error(
          'No savings on the ledger yet. Make a deposit on Home first. ' +
          'Loans are limited to 3× your savings balance (yours is UGX 0).'
        );
      }
      throw new Error(
        `Loan amount (UGX ${loanAmount.toLocaleString()}) exceeds the maximum allowed ` +
        `(3× savings = UGX ${maxLoan.toLocaleString()}). ` +
        `Your savings balance is UGX ${savingsBalance.toLocaleString()}.`
      );
    }

    // ── Check for existing active loan ────────────────────────────────────
    const existingLoans = await richQuery(ctx, {
      selector: {
        docType:  'loan',
        memberId: memberId,
        status:   { $in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.DISBURSED] },
      },
    });
    if (existingLoans.length > 0) {
      throw new Error(`Member '${memberId}' already has an active loan. Please repay it first.`);
    }

    // ── Calculate loan financials ─────────────────────────────────────────
    const interestTotal    = loanAmount * LOAN_POLICY.INTEREST_RATE_MONTHLY * term;
    const processingFee    = loanAmount * LOAN_POLICY.PROCESSING_FEE_RATE;
    const totalRepayable   = loanAmount + interestTotal + processingFee;
    const monthlyInstalment = totalRepayable / term;

    const now  = getTxTimestamp(ctx);
    const txId = ctx.stub.getTxID();
    const loanId = `LOAN-${memberId}-${Date.now()}`;
    const loanKey = buildKey(KeyPrefix.LOAN, loanId);

    const loan = {
      docType:            'loan',
      loanId,
      memberId,
      amount:             loanAmount,
      termMonths:         term,
      purpose,
      guarantorId,
      status:             LoanStatus.PENDING,

      // Financials
      interestRate:       LOAN_POLICY.INTEREST_RATE_MONTHLY,
      interestTotal,
      processingFee,
      totalRepayable,
      monthlyInstalment:  Math.ceil(monthlyInstalment),

      // Repayment tracking
      amountRepaid:       0,
      outstandingBalance: totalRepayable,
      repaymentCount:     0,
      nextDueDate:        null,

      // Audit fields
      appliedAt:          now,
      approvedAt:         null,
      disbursedAt:        null,
      closedAt:           null,
      approvedBy:         null,
      disbursedBy:        null,
      rejectionReason:    null,
      applicationTxId:    txId,
    };

    await putState(ctx, loanKey, loan);

    // Write an application transaction record
    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    await putState(ctx, txKey, {
      docType:   'transaction',
      txId,
      type:      TxType.LOAN_APPLY,
      memberId,
      loanId,
      amount:    loanAmount,
      timestamp: now,
    });

    ctx.stub.setEvent('LoanApplicationSubmitted', Buffer.from(JSON.stringify({
      loanId, memberId, amount: loanAmount, termMonths: term, appliedAt: now,
    })));

    return {
      success: true,
      loanId,
      memberId,
      amount:            loanAmount,
      monthlyInstalment: Math.ceil(monthlyInstalment),
      totalRepayable,
      termMonths:        term,
      status:            LoanStatus.PENDING,
      message:           'Loan application submitted. Awaiting admin approval.',
    };
  }

  // ─── Approve Loan ─────────────────────────────────────────────────────────
  /**
   * Admin approves a pending loan application.
   * Sets status to APPROVED; disbursement is a separate step.
   *
   * Note: Do not use default parameter values after `loanId`. Fabric derives the
   * transaction arg count from `Function.prototype.length`, which stops at the first
   * default — that would register only `loanId` and reject a second (remarks) arg.
   */
  async approveLoan(ctx, loanId, remarks) {
    remarks = remarks ?? '';
    requireRole(ctx, 'admin');

    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    const loan = await getState(ctx, loanKey);

    if (loan.status !== LoanStatus.PENDING) {
      throw new Error(`Loan '${loanId}' is not in PENDING status (current: ${loan.status}).`);
    }

    const now    = getTxTimestamp(ctx);
    const txId   = ctx.stub.getTxID();
    const caller = getCallerIdentity(ctx);

    loan.status     = LoanStatus.APPROVED;
    loan.approvedAt = now;
    loan.approvedBy = caller.id;
    loan.remarks    = remarks;

    await putState(ctx, loanKey, loan);

    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    await putState(ctx, txKey, {
      docType:   'transaction',
      txId,
      type:      TxType.LOAN_APPROVE,
      memberId:  loan.memberId,
      loanId,
      amount:    loan.amount,
      approvedBy: caller.id,
      timestamp: now,
    });

    ctx.stub.setEvent('LoanApproved', Buffer.from(JSON.stringify({
      loanId, memberId: loan.memberId, amount: loan.amount, approvedAt: now,
    })));

    return { success: true, loanId, status: LoanStatus.APPROVED, approvedAt: now };
  }

  // ─── Reject Loan ──────────────────────────────────────────────────────────
  async rejectLoan(ctx, loanId, reason) {
    requireRole(ctx, 'admin');

    if (!reason || reason.trim().length === 0) {
      throw new Error('A rejection reason must be provided.');
    }

    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    const loan = await getState(ctx, loanKey);

    if (loan.status !== LoanStatus.PENDING) {
      throw new Error(`Loan '${loanId}' is not in PENDING status.`);
    }

    const now    = getTxTimestamp(ctx);
    const txId   = ctx.stub.getTxID();
    const caller = getCallerIdentity(ctx);

    loan.status          = LoanStatus.REJECTED;
    loan.rejectionReason = reason;
    loan.rejectedBy      = caller.id;
    loan.rejectedAt      = now;

    await putState(ctx, loanKey, loan);

    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    await putState(ctx, txKey, {
      docType:    'transaction',
      txId,
      type:       TxType.LOAN_REJECT,
      memberId:   loan.memberId,
      loanId,
      reason,
      rejectedBy: caller.id,
      timestamp:  now,
    });

    ctx.stub.setEvent('LoanRejected', Buffer.from(JSON.stringify({
      loanId, memberId: loan.memberId, reason, rejectedAt: now,
    })));

    return { success: true, loanId, status: LoanStatus.REJECTED, reason };
  }

  // ─── Disburse Loan ────────────────────────────────────────────────────────
  /**
   * Mark a loan as disbursed (funds physically sent to member).
   * Sets next due date for first repayment.
   */
  async disburseLoan(ctx, loanId, disbursementRef) {
    requireRole(ctx, 'admin');

    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    const loan = await getState(ctx, loanKey);

    if (loan.status !== LoanStatus.APPROVED) {
      throw new Error(`Loan '${loanId}' must be in APPROVED status to disburse.`);
    }

    const now    = getTxTimestamp(ctx);
    const txId   = ctx.stub.getTxID();
    const caller = getCallerIdentity(ctx);

    // Calculate first repayment due date (30 days from now)
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    loan.status          = LoanStatus.DISBURSED;
    loan.disbursedAt     = now;
    loan.disbursedBy     = caller.id;
    loan.disbursementRef = disbursementRef;
    loan.nextDueDate     = dueDate.toISOString();

    await putState(ctx, loanKey, loan);

    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    await putState(ctx, txKey, {
      docType:        'transaction',
      txId,
      type:           TxType.LOAN_DISBURSE,
      memberId:       loan.memberId,
      loanId,
      amount:         loan.amount,
      disbursementRef,
      disbursedBy:    caller.id,
      timestamp:      now,
    });

    ctx.stub.setEvent('LoanDisbursed', Buffer.from(JSON.stringify({
      loanId, memberId: loan.memberId, amount: loan.amount, disbursedAt: now,
    })));

    return {
      success: true,
      loanId,
      status:      LoanStatus.DISBURSED,
      disbursedAt: now,
      nextDueDate: dueDate.toISOString(),
    };
  }

  // ─── Repay Loan ───────────────────────────────────────────────────────────
  /**
   * Record a loan repayment instalment.
   * Automatically marks the loan as REPAID when fully settled.
   *
   * @param {string} loanId     - Target loan
   * @param {string} amount     - Repayment amount
   * @param {string} reference  - Payment reference (e.g. mobile money transaction ID)
   * @param {string} channel    - Payment channel
   *
   * Note: Same as approveLoan — no default on `channel` so Fabric registers four args.
   */
  async repayLoan(ctx, loanId, amount, reference, channel) {
    channel = channel || 'TELLER';
    requireRole(ctx, 'admin', 'member');

    const repayAmount = assertPositiveAmount(amount, 'Repayment amount');

    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    const loan = await getState(ctx, loanKey);

    if (loan.status !== LoanStatus.DISBURSED) {
      throw new Error(`Loan '${loanId}' is not in DISBURSED status. Cannot accept repayment.`);
    }

    if (repayAmount > loan.outstandingBalance) {
      throw new Error(
        `Repayment (UGX ${repayAmount.toLocaleString()}) exceeds outstanding balance ` +
        `(UGX ${loan.outstandingBalance.toLocaleString()}).`
      );
    }

    const now  = getTxTimestamp(ctx);
    const txId = ctx.stub.getTxID();

    loan.amountRepaid       += repayAmount;
    loan.outstandingBalance -= repayAmount;
    loan.repaymentCount     += 1;

    // Calculate next due date (30 days from now)
    const nextDue = new Date(now);
    nextDue.setDate(nextDue.getDate() + 30);
    loan.nextDueDate = nextDue.toISOString();

    // Check if fully repaid
    if (loan.outstandingBalance <= 0) {
      loan.status    = LoanStatus.REPAID;
      loan.closedAt  = now;
      loan.nextDueDate = null;
    }

    await putState(ctx, loanKey, loan);

    // Save repayment record
    const repaymentKey = buildKey(KeyPrefix.REPAYMENT, loanId, txId);
    const repayment = {
      docType:            'repayment',
      repaymentId:        txId,
      loanId,
      memberId:           loan.memberId,
      amount:             repayAmount,
      outstandingAfter:   loan.outstandingBalance,
      reference,
      channel,
      repaymentNumber:    loan.repaymentCount,
      paidAt:             now,
      initiatedBy:        getCallerIdentity(ctx).id,
    };
    await putState(ctx, repaymentKey, repayment);

    // Also write a transaction record
    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    await putState(ctx, txKey, {
      docType:          'transaction',
      txId,
      type:             TxType.LOAN_REPAY,
      memberId:         loan.memberId,
      loanId,
      amount:           repayAmount,
      outstandingAfter: loan.outstandingBalance,
      reference,
      channel,
      timestamp:        now,
    });

    ctx.stub.setEvent('LoanRepayment', Buffer.from(JSON.stringify({
      loanId,
      memberId:      loan.memberId,
      amountPaid:    repayAmount,
      outstanding:   loan.outstandingBalance,
      isFullyRepaid: loan.status === LoanStatus.REPAID,
      timestamp:     now,
    })));

    return {
      success:        true,
      txId,
      loanId,
      amountPaid:     repayAmount,
      outstanding:    loan.outstandingBalance,
      isFullyRepaid:  loan.status === LoanStatus.REPAID,
      nextDueDate:    loan.nextDueDate,
      timestamp:      now,
    };
  }

  // ─── Get Loan ─────────────────────────────────────────────────────────────
  async getLoan(ctx, loanId) {
    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    return await getState(ctx, loanKey);
  }

  // ─── Get Member Loans ─────────────────────────────────────────────────────
  /** CouchDB: avoid `sort` in Mango (requires a matching index); sort in chaincode. */
  async getMemberLoans(ctx, memberId) {
    const rows = await richQuery(ctx, {
      selector: { docType: 'loan', memberId },
    });
    return rows.sort((a, b) =>
      String(b.appliedAt || '').localeCompare(String(a.appliedAt || ''))
    );
  }

  // ─── Get All Pending Loans (admin dashboard) ──────────────────────────────
  async getPendingLoans(ctx) {
    requireRole(ctx, 'admin');
    const rows = await richQuery(ctx, {
      selector: { docType: 'loan', status: LoanStatus.PENDING },
    });
    return rows.sort((a, b) =>
      String(a.appliedAt || '').localeCompare(String(b.appliedAt || ''))
    );
  }

  // ─── List loans (admin / auditor dashboard) ───────────────────────────────
  /**
   * Returns full loan state documents (not LOAN_APPLY transaction stubs).
   * @param {string} statusFilter - ALL | PENDING | APPROVED | DISBURSED | REPAID | REJECTED | DEFAULTED
   */
  async getAllLoans(ctx, statusFilter) {
    requireRole(ctx, 'admin', 'auditor');
    const raw = String(statusFilter || 'ALL').trim().toUpperCase();
    const selector = { docType: 'loan' };
    if (raw !== 'ALL') {
      if (!Object.prototype.hasOwnProperty.call(LoanStatus, raw)) {
        throw new Error(
          `Invalid loan status filter '${statusFilter}'. Expected ALL or one of: ${Object.keys(LoanStatus).join(', ')}.`
        );
      }
      selector.status = LoanStatus[raw];
    }
    const rows = await richQuery(ctx, { selector });
    return rows.sort((a, b) =>
      String(b.appliedAt || '').localeCompare(String(a.appliedAt || ''))
    );
  }

  // ─── Get Loan Repayments ──────────────────────────────────────────────────
  async getLoanRepayments(ctx, loanId) {
    requireRole(ctx, 'admin', 'auditor', 'member');
    const rows = await richQuery(ctx, {
      selector: { docType: 'repayment', loanId },
    });
    return rows.sort((a, b) =>
      String(a.paidAt || '').localeCompare(String(b.paidAt || ''))
    );
  }

  // ─── Loan History (audit trail) ───────────────────────────────────────────
  async getLoanHistory(ctx, loanId) {
    requireRole(ctx, 'admin', 'auditor');
    const loanKey = buildKey(KeyPrefix.LOAN, loanId);
    return await getHistory(ctx, loanKey);
  }

  // ─── Get Policy ───────────────────────────────────────────────────────────
  async getLoanPolicy(ctx) {
    return LOAN_POLICY;
  }
}

module.exports = LoansContract;
