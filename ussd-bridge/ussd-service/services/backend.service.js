// =============================================================================
// TrustLedger USSD Service - Backend API Client
//
// Embedded on Railway: uses in-process DB/Fabric (USSD_EMBED_DIRECT=true).
// Standalone bridge: calls /api/v1/internal/ussd/* with X-Service-Key (NOT Bearer).
// Africa's Talking never sends JWT — only POSTs to /ussd-bridge/ussd.
// =============================================================================

'use strict';

const axios  = require('axios');
const config = require('../config');
const logger = require('../config/logger');

const LOOKUP_TIMEOUT_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 10_000;

let directBackend = null;
let directResolved = false;

function useDirectBackend() {
  if (directResolved) return directBackend;
  directResolved = true;
  const flag = String(process.env.USSD_EMBED_DIRECT || '').toLowerCase();
  if (flag !== 'true' && flag !== '1') return null;
  try {
    directBackend = require('./backend-direct.service');
    logger.info('USSD bridge: in-process backend (no HTTP, no Bearer token)');
  } catch (err) {
    logger.warn(`USSD in-process backend unavailable: ${err.message}`);
    directBackend = null;
  }
  return directBackend;
}

// ── Axios instance (standalone bridge or when direct mode is off) ───────────────
const api = axios.create({
  baseURL: config.backend.apiUrl,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type':   'application/json',
    'X-Service-Key':  config.backend.apiKey,
    'X-Service-Name': 'ussd-bridge',
  },
});

api.interceptors.request.use((req) => {
  logger.debug(`→ ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`);
  return req;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg    = err.response?.data?.message || err.message;
    logger.error(`← ${status || 'ERR'} ${err.config?.url}: ${msg}`);
    return Promise.reject(err);
  }
);

const unwrap = (res) => res.data?.data;

function mapHttpError(err) {
  const status = err.response?.status;
  const msg = String(err.response?.data?.message || err.message || '');

  if (status === 404) return null;

  if (status === 401 || /authentication required|bearer token/i.test(msg)) {
    const e = new Error('USSD internal API auth failed — use X-Service-Key on /internal/ussd/*, not Bearer on /members');
    e.code = 'AUTH_CONFIG';
    throw e;
  }

  if (status === 403) {
    if (/service key|not configured/i.test(msg)) {
      const e = new Error(msg);
      e.code = 'AUTH_CONFIG';
      throw e;
    }
    const e = new Error(msg || 'Account not active');
    e.code = 'INACTIVE';
    throw e;
  }

  if (status === 503) {
    const e = new Error(msg || 'USSD internal API not configured');
    e.code = 'AUTH_CONFIG';
    throw e;
  }

  throw err;
}

async function getMemberByPhone(phone) {
  const direct = useDirectBackend();
  if (direct) return direct.getMemberByPhone(phone);

  try {
    const res = await api.get('/internal/ussd/members/by-phone', {
      params:  { phone },
      timeout: LOOKUP_TIMEOUT_MS,
    });
    return unwrap(res);
  } catch (err) {
    return mapHttpError(err);
  }
}

async function getUssdBalance(memberId) {
  const direct = useDirectBackend();
  if (direct) return direct.getUssdBalance(memberId);
  const res = await api.get(`/internal/ussd/members/${memberId}/ussd-balance`);
  return unwrap(res);
}

async function getMiniStatement(memberId) {
  const direct = useDirectBackend();
  if (direct) return direct.getMiniStatement(memberId);
  const res = await api.get(`/internal/ussd/members/${memberId}/ussd-mini-statement`);
  return unwrap(res);
}

async function getBalance(memberId) {
  const direct = useDirectBackend();
  if (direct) return direct.getBalance(memberId);
  const res = await api.get(`/internal/ussd/members/${memberId}/balance`);
  return unwrap(res);
}

async function getActiveLoan(memberId) {
  const direct = useDirectBackend();
  if (direct) return direct.getActiveLoan(memberId);
  const res   = await api.get(`/internal/ussd/members/${memberId}/loans`);
  const loans = unwrap(res) || [];
  return loans.find(l => ['PENDING', 'APPROVED', 'DISBURSED'].includes(l.status)) || null;
}

async function getDisbursedLoan(memberId) {
  const direct = useDirectBackend();
  if (direct) return direct.getDisbursedLoan(memberId);
  const res   = await api.get(`/internal/ussd/members/${memberId}/loans`);
  const loans = unwrap(res) || [];
  return loans.find(l => l.status === 'DISBURSED') || null;
}

async function applyForLoan(memberId, amount, termMonths, purpose) {
  const direct = useDirectBackend();
  if (direct) return direct.applyForLoan(memberId, amount, termMonths, purpose);
  const res = await api.post('/internal/ussd/loans', { memberId, amount, termMonths, purpose });
  return unwrap(res);
}

async function submitRepaymentRequest(memberId, loanId, amount, reference) {
  const direct = useDirectBackend();
  if (direct) return direct.submitRepaymentRequest(memberId, loanId, amount, reference);
  const res = await api.post(`/internal/ussd/loans/${loanId}/repay`, {
    memberId, amount, reference,
  });
  return unwrap(res);
}

async function submitSavingsRequest(memberId, amount, reference) {
  const direct = useDirectBackend();
  if (direct) return direct.submitSavingsRequest(memberId, amount, reference);
  const res = await api.post('/internal/ussd/savings-request', {
    memberId, amount, reference,
  });
  return unwrap(res);
}

async function getLoanPolicy() {
  const direct = useDirectBackend();
  if (direct) return direct.getLoanPolicy();
  const res = await api.get('/loans/policy');
  return unwrap(res);
}

async function checkBackendHealth() {
  const direct = useDirectBackend();
  if (direct) return direct.checkBackendHealth();
  try {
    const res = await api.get('/health');
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getMemberByPhone,
  getUssdBalance,
  getMiniStatement,
  getBalance,
  getActiveLoan,
  getDisbursedLoan,
  applyForLoan,
  submitRepaymentRequest,
  submitSavingsRequest,
  getLoanPolicy,
  checkBackendHealth,
  useDirectBackend,
};
