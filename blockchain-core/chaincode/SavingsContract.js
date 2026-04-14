// =============================================================================
// TrustLedger - Savings Contract
// Handles: member registration, deposits, withdrawals, balance queries
// =============================================================================

'use strict';

const { Contract } = require('fabric-contract-api');
const {
  TxType, MemberStatus, KeyPrefix,
  buildKey, getTxTimestamp, getCallerIdentity,
  requireRole, assertPositiveAmount,
  getState, putState, deleteState, stateExists,
  richQuery, getHistory,
} = require('./common/utils');

/** Fabric txn uses 3 args only; optional channel is sent as "[CHANNEL] paymentRef". */
const DEPOSIT_CHANNELS = new Set(['TELLER', 'MOBILE_APP', 'USSD', 'BANK_TRANSFER']);

function parseDepositReference(reference) {
  const ref = typeof reference === 'string' ? reference.trim() : String(reference);
  const m = ref.match(/^\[(TELLER|MOBILE_APP|USSD|BANK_TRANSFER)\]\s*(.+)$/s);
  if (m && DEPOSIT_CHANNELS.has(m[1])) {
    return { channel: m[1], paymentReference: m[2].trim() };
  }
  return { channel: 'TELLER', paymentReference: ref };
}

/** Fabric txn uses 3 args; API packs reference + reason (keep in sync with members.controller). */
const LEDGER_WITHDRAW_SEP = '|||!TLW!|||';

function parseWithdrawPacked(packed) {
  const s = typeof packed === 'string' ? packed.trim() : String(packed);
  const i = s.indexOf(LEDGER_WITHDRAW_SEP);
  if (i === -1) return { reference: s, reason: '' };
  return {
    reference: s.slice(0, i).trim(),
    reason:    s.slice(i + LEDGER_WITHDRAW_SEP.length).trim(),
  };
}

/** Optional `[CHANNEL] ` prefix (same as deposits) + ref|||!TLW!|||reason payload. */
function parseWithdrawChainArg(packedReference) {
  const { channel, paymentReference: inner } = parseDepositReference(packedReference);
  const { reference, reason } = parseWithdrawPacked(inner);
  return { channel, reference, reason };
}

class SavingsContract extends Contract {

  constructor() {
    // Namespace for this contract on the channel
    super('SavingsContract');
  }

  // ─── Init Ledger ──────────────────────────────────────────────────────────
  async initLedger(ctx) {
    console.log('SavingsContract: Ledger initialized for TrustLedger SACCO');
    return { success: true, message: 'SavingsContract ledger initialized' };
  }

  // ─── Register Member ──────────────────────────────────────────────────────
  /**
   * Register a new SACCO member on the blockchain.
   * Only admins can call this function (RBAC enforced).
   *
   * @param {string} memberId    - Unique member ID (e.g. MEM001)
   * @param {string} fullName    - Full legal name
   * @param {string} phone       - Phone number (used for USSD)
   * @param {string} nationalId  - National ID number
   * @param {string} role        - 'member' | 'admin' | 'auditor' (omit empty for default member)
   */
  async registerMember(ctx, memberId, fullName, phone, nationalId, role) {
    requireRole(ctx, 'admin');

    const effectiveRole =
      role != null && String(role).trim() !== '' ? String(role).toLowerCase() : 'member';

    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);

    if (await stateExists(ctx, memberKey)) {
      throw new Error(`Member '${memberId}' already exists.`);
    }

    const now = getTxTimestamp(ctx);
    const caller = getCallerIdentity(ctx);

    // Member profile record
    const member = {
      docType:      'member',
      memberId,
      fullName,
      phone,
      nationalId,
      role:         effectiveRole,
      status:       MemberStatus.ACTIVE,
      registeredBy: caller.id,
      registeredAt: now,
      updatedAt:    now,
    };

    // Savings account record (starts at zero)
    const savingsAccount = {
      docType:          'savings',
      memberId,
      balance:          0,
      totalDeposited:   0,
      totalWithdrawn:   0,
      transactionCount: 0,
      createdAt:        now,
      updatedAt:        now,
    };

    await putState(ctx, memberKey, member);
    await putState(ctx, savingsKey, savingsAccount);

    // Emit an event for the backend to pick up
    ctx.stub.setEvent('MemberRegistered', Buffer.from(JSON.stringify({
      memberId, fullName, phone, registeredAt: now,
    })));

    return { success: true, memberId, message: `Member ${fullName} registered successfully.` };
  }

  // ─── Deposit ──────────────────────────────────────────────────────────────
  /**
   * Record a savings deposit for a member.
   * Can be called by admin (teller) or the member themselves.
   * Exactly three chaincode args after ctx (Fabric rejects a 4th parameter on older deployments).
   * Optional channel: prefix reference as "[BANK_TRANSFER] ref123" (see DEPOSIT_CHANNELS).
   *
   * @param {string} memberId  - Target member
   * @param {string} amount    - Deposit amount (UGX)
   * @param {string} reference - Payment reference, optionally "[CHANNEL] ref"
   */
  async deposit(ctx, memberId, amount, reference) {
    requireRole(ctx, 'admin', 'member');

    const { channel, paymentReference } = parseDepositReference(reference);
    const depositAmount = assertPositiveAmount(amount, 'Deposit amount');

    // Verify member exists and is active
    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const member = await getState(ctx, memberKey);
    if (member.status !== MemberStatus.ACTIVE) {
      throw new Error(`Member '${memberId}' account is not active (status: ${member.status}).`);
    }

    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);

    const now = getTxTimestamp(ctx);
    const txId = ctx.stub.getTxID();

    // Update savings balance
    savings.balance          += depositAmount;
    savings.totalDeposited   += depositAmount;
    savings.transactionCount += 1;
    savings.updatedAt         = now;

    await putState(ctx, savingsKey, savings);

    // Write transaction record to ledger
    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    const transaction = {
      docType:     'transaction',
      txId,
      type:        TxType.DEPOSIT,
      memberId,
      amount:      depositAmount,
      balanceAfter: savings.balance,
      reference:   paymentReference,
      channel,
      initiatedBy: getCallerIdentity(ctx).id,
      timestamp:   now,
    };
    await putState(ctx, txKey, transaction);

    ctx.stub.setEvent('Deposit', Buffer.from(JSON.stringify({
      memberId, amount: depositAmount, balanceAfter: savings.balance, txId, timestamp: now,
    })));

    return {
      success: true,
      txId,
      memberId,
      amountDeposited: depositAmount,
      newBalance:      savings.balance,
      timestamp:       now,
    };
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────
  /**
   * Record a withdrawal from a member's savings.
   * Admins only (teller-approved withdrawals).
   * Exactly three chaincode args after ctx. Payload:
   *   `ref + LEDGER_WITHDRAW_SEP + reason`, or
   *   `[BANK_TRANSFER] ref + LEDGER_WITHDRAW_SEP + reason` (optional channel prefix).
   *
   * @param {string} memberId       - Target member
   * @param {string} amount         - Withdrawal amount (UGX)
   * @param {string} packedReference - Packed ref/reason; optional [CHANNEL] prefix
   */
  async withdraw(ctx, memberId, amount, packedReference) {
    requireRole(ctx, 'admin');

    const { channel, reference, reason } = parseWithdrawChainArg(packedReference);
    const withdrawAmount = assertPositiveAmount(amount, 'Withdrawal amount');

    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const member = await getState(ctx, memberKey);
    if (member.status !== MemberStatus.ACTIVE) {
      throw new Error(`Member '${memberId}' account is not active.`);
    }

    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);

    if (savings.balance < withdrawAmount) {
      throw new Error(
        `Insufficient funds. Balance: UGX ${savings.balance}, ` +
        `Requested: UGX ${withdrawAmount}`
      );
    }

    // Enforce minimum balance rule (e.g. UGX 50,000 must always remain)
    const MINIMUM_BALANCE = 50000;
    if ((savings.balance - withdrawAmount) < MINIMUM_BALANCE) {
      throw new Error(
        `Withdrawal would breach minimum balance of UGX ${MINIMUM_BALANCE}. ` +
        `Available to withdraw: UGX ${savings.balance - MINIMUM_BALANCE}`
      );
    }

    const now = getTxTimestamp(ctx);
    const txId = ctx.stub.getTxID();

    savings.balance          -= withdrawAmount;
    savings.totalWithdrawn   += withdrawAmount;
    savings.transactionCount += 1;
    savings.updatedAt         = now;

    await putState(ctx, savingsKey, savings);

    const txKey = buildKey(KeyPrefix.TRANSACTION, txId);
    const transaction = {
      docType:      'transaction',
      txId,
      type:         TxType.WITHDRAWAL,
      memberId,
      amount:       withdrawAmount,
      balanceAfter: savings.balance,
      reference,
      reason,
      channel,
      initiatedBy:  getCallerIdentity(ctx).id,
      timestamp:    now,
    };
    await putState(ctx, txKey, transaction);

    ctx.stub.setEvent('Withdrawal', Buffer.from(JSON.stringify({
      memberId, amount: withdrawAmount, balanceAfter: savings.balance, txId, timestamp: now,
    })));

    return {
      success: true,
      txId,
      memberId,
      amountWithdrawn: withdrawAmount,
      newBalance:      savings.balance,
      timestamp:       now,
    };
  }

  // ─── Get Member Balance ───────────────────────────────────────────────────
  /**
   * Query the current savings balance for a member.
   * Any authenticated role can check balance.
   */
  async getBalance(ctx, memberId) {
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    const savings = await getState(ctx, savingsKey);
    return {
      memberId,
      balance:        savings.balance,
      totalDeposited: savings.totalDeposited,
      totalWithdrawn: savings.totalWithdrawn,
      updatedAt:      savings.updatedAt,
    };
  }

  // ─── Get Member Profile ───────────────────────────────────────────────────
  async getMember(ctx, memberId) {
    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    return await getState(ctx, memberKey);
  }

  // ─── Get Member Transactions ──────────────────────────────────────────────
  /**
   * Retrieve all transactions for a member using CouchDB rich query.
   */
  async getMemberTransactions(ctx, memberId) {
    requireRole(ctx, 'admin', 'auditor', 'member');
    const rows = await richQuery(ctx, {
      selector: {
        docType:  'transaction',
        memberId: memberId,
      },
    });
    return rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  }

  // ─── Get Savings History (Audit Trail) ────────────────────────────────────
  /**
   * Get the immutable history of changes to a savings account.
   * Used by auditors to verify account integrity.
   */
  async getSavingsHistory(ctx, memberId) {
    requireRole(ctx, 'admin', 'auditor');
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);
    return await getHistory(ctx, savingsKey);
  }

  // ─── Get All Members ──────────────────────────────────────────────────────
  async getAllMembers(ctx) {
    requireRole(ctx, 'admin', 'auditor');
    const rows = await richQuery(ctx, {
      selector: { docType: 'member' },
    });
    return rows.sort((a, b) =>
      String(b.registeredAt || '').localeCompare(String(a.registeredAt || ''))
    );
  }

  /**
   * Remove member + savings state so the same memberId can be registered again.
   * Admin only. Balance must be zero; no PENDING/APPROVED/DISBURSED loans for this member.
   */
  async purgeLedgerMember(ctx, memberId) {
    requireRole(ctx, 'admin');

    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const savingsKey = buildKey(KeyPrefix.SAVINGS, memberId);

    if (!(await stateExists(ctx, memberKey))) {
      throw new Error(`Member '${memberId}' not found on ledger.`);
    }

    const savings = await getState(ctx, savingsKey);
    const bal = Number(savings.balance) || 0;
    if (bal !== 0) {
      throw new Error(
        `Cannot purge '${memberId}': savings balance is UGX ${bal}. Zero the balance first (withdraw).`
      );
    }

    const activeLoans = await richQuery(ctx, {
      selector: {
        docType:  'loan',
        memberId: memberId,
        status:   { $in: ['PENDING', 'APPROVED', 'DISBURSED'] },
      },
    });
    if (activeLoans.length > 0) {
      throw new Error(
        `Cannot purge '${memberId}': ${activeLoans.length} active loan(s) exist. Resolve them first.`
      );
    }

    await deleteState(ctx, memberKey);
    await deleteState(ctx, savingsKey);

    return {
      success: true,
      memberId,
      message: 'Ledger member and savings records removed. Register this ID again from the admin dashboard.',
    };
  }

  // ─── Suspend / Reactivate Member ──────────────────────────────────────────
  async updateMemberStatus(ctx, memberId, newStatus, reason) {
    requireRole(ctx, 'admin');

    if (!Object.values(MemberStatus).includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const memberKey = buildKey(KeyPrefix.MEMBER, memberId);
    const member = await getState(ctx, memberKey);
    member.status    = newStatus;
    member.updatedAt = getTxTimestamp(ctx);
    member.statusReason = reason;

    await putState(ctx, memberKey, member);

    return { success: true, memberId, newStatus, reason };
  }
}

module.exports = SavingsContract;
