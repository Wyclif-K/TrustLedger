// =============================================================================
// TrustLedger - Shared Types & Utilities
// Used across savings, loans, and ledger chaincode contracts
// =============================================================================

'use strict';

// ─── Transaction Types ────────────────────────────────────────────────────────
const TxType = {
  DEPOSIT:        'DEPOSIT',
  WITHDRAWAL:     'WITHDRAWAL',
  LOAN_APPLY:     'LOAN_APPLY',
  LOAN_APPROVE:   'LOAN_APPROVE',
  LOAN_REJECT:    'LOAN_REJECT',
  LOAN_DISBURSE:  'LOAN_DISBURSE',
  LOAN_REPAY:     'LOAN_REPAY',
  MEMBER_REGISTER:'MEMBER_REGISTER',
};

// ─── Status Enums ─────────────────────────────────────────────────────────────
const LoanStatus = {
  PENDING:    'PENDING',
  APPROVED:   'APPROVED',
  REJECTED:   'REJECTED',
  DISBURSED:  'DISBURSED',
  REPAID:     'REPAID',
  DEFAULTED:  'DEFAULTED',
};

const MemberStatus = {
  ACTIVE:     'ACTIVE',
  SUSPENDED:  'SUSPENDED',
  CLOSED:     'CLOSED',
};

// ─── Key Prefixes (CouchDB composite keys) ─────────────────────────────────────
const KeyPrefix = {
  MEMBER:      'MEMBER',
  SAVINGS:     'SAVINGS',
  TRANSACTION: 'TX',
  LOAN:        'LOAN',
  REPAYMENT:   'REPAYMENT',
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Build a composite ledger key
 * e.g. buildKey('MEMBER', 'MEM001') → 'MEMBER:MEM001'
 */
function buildKey(prefix, ...parts) {
  return [prefix, ...parts].join(':');
}

/**
 * Get current timestamp from the transaction
 * @param {Context} ctx - Fabric contract context
 */
function getTxTimestamp(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  return new Date(ts.seconds.low * 1000).toISOString();
}

/**
 * Get the calling identity's MSP ID and common name
 * @param {Context} ctx - Fabric contract context
 */
function getCallerIdentity(ctx) {
  const clientIdentity = ctx.clientIdentity;
  return {
    mspId:  clientIdentity.getMSPID(),
    id:     clientIdentity.getID(),
    role:   clientIdentity.getAttributeValue('role') || 'member',
  };
}

/**
 * Assert that the caller has the required role.
 * Throws an error if the role check fails.
 */
function requireRole(ctx, ...allowedRoles) {
  const caller = getCallerIdentity(ctx);
  if (!allowedRoles.includes(caller.role)) {
    throw new Error(
      `Access denied. Required role(s): [${allowedRoles.join(', ')}]. ` +
      `Caller role: '${caller.role}'`
    );
  }
}

/**
 * Validate that a value is a positive number
 */
function assertPositiveAmount(amount, fieldName = 'amount') {
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive number. Got: ${amount}`);
  }
  return n;
}

/**
 * Read a JSON state object from the ledger.
 * Throws if the key does not exist.
 */
async function getState(ctx, key) {
  const data = await ctx.stub.getState(key);
  if (!data || data.length === 0) {
    throw new Error(`No record found for key: ${key}`);
  }
  return JSON.parse(data.toString());
}

/**
 * Write a JSON state object to the ledger.
 */
async function putState(ctx, key, obj) {
  await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
}

/**
 * Check if a key exists on the ledger (without throwing).
 */
async function stateExists(ctx, key) {
  const data = await ctx.stub.getState(key);
  return data && data.length > 0;
}

/**
 * Run a rich CouchDB query and return all matching records.
 * @param {Context} ctx
 * @param {object} query - CouchDB selector object
 */
async function richQuery(ctx, query) {
  const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
  const iterator = await ctx.stub.getQueryResult(queryStr);
  const results = [];

  let res = await iterator.next();
  while (!res.done) {
    const record = JSON.parse(res.value.value.toString());
    results.push(record);
    res = await iterator.next();
  }
  await iterator.close();
  return results;
}

/**
 * Get full history for a key (audit trail).
 * Returns array of { txId, timestamp, isDelete, value }
 */
async function getHistory(ctx, key) {
  const iterator = await ctx.stub.getHistoryForKey(key);
  const history = [];

  let res = await iterator.next();
  while (!res.done) {
    const entry = {
      txId:      res.value.txId,
      timestamp: new Date(res.value.timestamp.seconds.low * 1000).toISOString(),
      isDelete:  res.value.isDelete,
      value:     res.value.isDelete ? null : JSON.parse(res.value.value.toString()),
    };
    history.push(entry);
    res = await iterator.next();
  }
  await iterator.close();
  return history;
}

module.exports = {
  TxType,
  LoanStatus,
  MemberStatus,
  KeyPrefix,
  buildKey,
  getTxTimestamp,
  getCallerIdentity,
  requireRole,
  assertPositiveAmount,
  getState,
  putState,
  stateExists,
  richQuery,
  getHistory,
};
