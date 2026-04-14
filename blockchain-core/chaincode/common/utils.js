// =============================================================================
// TrustLedger - Shared Types & Utilities (chaincode)
// Single shared module for all chaincode contracts (Fabric packages this tree).
// =============================================================================

'use strict';

const TxType = {
  DEPOSIT:         'DEPOSIT',
  WITHDRAWAL:      'WITHDRAWAL',
  LOAN_APPLY:      'LOAN_APPLY',
  LOAN_APPROVE:    'LOAN_APPROVE',
  LOAN_REJECT:     'LOAN_REJECT',
  LOAN_DISBURSE:   'LOAN_DISBURSE',
  LOAN_REPAY:      'LOAN_REPAY',
  MEMBER_REGISTER: 'MEMBER_REGISTER',
};

const LoanStatus = {
  PENDING:   'PENDING',
  APPROVED:  'APPROVED',
  REJECTED:  'REJECTED',
  DISBURSED: 'DISBURSED',
  REPAID:    'REPAID',
  DEFAULTED: 'DEFAULTED',
};

const MemberStatus = {
  ACTIVE:    'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSED:    'CLOSED',
};

const KeyPrefix = {
  MEMBER:      'MEMBER',
  SAVINGS:     'SAVINGS',
  TRANSACTION: 'TX',
  LOAN:        'LOAN',
  REPAYMENT:   'REPAYMENT',
};

function buildKey(prefix, ...parts) {
  return [prefix, ...parts].join(':');
}

/**
 * Convert Fabric / protobuf Timestamp to milliseconds.
 * History queries use google.protobuf.Timestamp.toObject() → `seconds` is often a number.
 * Transaction context uses Long-like `{ low, high }` for `seconds`.
 */
function protobufTimestampToMillis(ts) {
  if (ts == null) return NaN;
  const rawSec = ts.seconds;

  if (rawSec == null) return NaN;

  let secNum;
  if (typeof rawSec === 'bigint') {
    secNum = Number(rawSec);
  } else if (typeof rawSec === 'string') {
    secNum = Number(rawSec.trim());
  } else if (typeof rawSec === 'number' && Number.isFinite(rawSec)) {
    secNum = rawSec;
  } else if (typeof rawSec === 'object' && rawSec !== null) {
    if (typeof rawSec.toNumber === 'function') {
      try {
        secNum = rawSec.toNumber();
      } catch {
        secNum = NaN;
      }
    } else if ('low' in rawSec) {
      const low = rawSec.low >>> 0;
      const high = (rawSec.high || 0) | 0;
      secNum = high * 0x100000000 + low;
    } else {
      secNum = NaN;
    }
  } else {
    secNum = Number(rawSec);
  }

  if (!Number.isFinite(secNum)) return NaN;
  const nanoRaw = ts.nanos;
  const nanos =
    typeof nanoRaw === 'bigint'
      ? Number(nanoRaw)
      : Number(nanoRaw) || 0;
  return secNum * 1000 + nanos / 1e6;
}

function protobufTimestampToIsoString(ts) {
  try {
    const ms = protobufTimestampToMillis(ts);
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function getTxTimestamp(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const iso = protobufTimestampToIsoString(ts);
  if (iso != null) return iso;
  if (typeof ctx.stub.getDateTimestamp === 'function') {
    try {
      const d = ctx.stub.getDateTimestamp();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
    } catch {
      /* ignore */
    }
  }
  return new Date(0).toISOString();
}

function getCallerIdentity(ctx) {
  const clientIdentity = ctx.clientIdentity;
  const id = clientIdentity.getID() || '';
  let role = clientIdentity.getAttributeValue('role');
  if (role) {
    role = String(role).toLowerCase();
  } else {
    // Cryptogen / dev certs usually have no custom "role" attribute; infer from enrollment CN
    if (/Admin@/i.test(id)) role = 'admin';
    else if (/Auditor@/i.test(id)) role = 'auditor';
    else role = 'member';
  }
  return {
    mspId: clientIdentity.getMSPID(),
    id,
    role,
  };
}

function requireRole(ctx, ...allowedRoles) {
  const caller = getCallerIdentity(ctx);
  if (!allowedRoles.includes(caller.role)) {
    throw new Error(
      `Access denied. Required role(s): [${allowedRoles.join(', ')}]. ` +
        `Caller role: '${caller.role}'`
    );
  }
}

function assertPositiveAmount(amount, fieldName = 'amount') {
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive number. Got: ${amount}`);
  }
  return n;
}

async function getState(ctx, key) {
  const data = await ctx.stub.getState(key);
  if (!data || data.length === 0) {
    throw new Error(`No record found for key: ${key}`);
  }
  return JSON.parse(data.toString());
}

async function putState(ctx, key, obj) {
  await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
}

async function deleteState(ctx, key) {
  await ctx.stub.deleteState(key);
}

async function stateExists(ctx, key) {
  const data = await ctx.stub.getState(key);
  return data && data.length > 0;
}

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

async function getHistory(ctx, key) {
  const iterator = await ctx.stub.getHistoryForKey(key);
  const history = [];

  let res = await iterator.next();
  while (!res.done) {
    const tsIso = protobufTimestampToIsoString(res.value.timestamp);
    let parsed = null;
    if (!res.value.isDelete && res.value.value && res.value.value.length) {
      try {
        parsed = JSON.parse(res.value.value.toString());
      } catch {
        parsed = null;
      }
    }
    const entry = {
      txId:      res.value.txId,
      timestamp: tsIso != null ? tsIso : new Date(0).toISOString(),
      isDelete:  res.value.isDelete,
      value:     res.value.isDelete ? null : parsed,
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
  protobufTimestampToMillis,
  protobufTimestampToIsoString,
  getTxTimestamp,
  getCallerIdentity,
  requireRole,
  assertPositiveAmount,
  getState,
  putState,
  deleteState,
  stateExists,
  richQuery,
  getHistory,
};
