// =============================================================================
// TrustLedger USSD Service - Backend API Client
//
// All blockchain data comes through the Phase 2 backend API.
// This service authenticates as a trusted internal service using an API key
// and wraps every call needed by the USSD menus.
// =============================================================================

'use strict';

const axios  = require('axios');
const config = require('../config');
const logger = require('../config/logger');

// ── Axios instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: config.backend.apiUrl,
  timeout: 10_000,
  headers: {
    'Content-Type':   'application/json',
    'X-Service-Key':  config.backend.apiKey,
    'X-Service-Name': 'ussd-bridge',
  },
});

// ── Log all outgoing calls ─────────────────────────────────────────────────────
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

// ── Helper: extract .data.data from response ───────────────────────────────────
const unwrap = (res) => res.data?.data;

// ── Lookup member by phone number ─────────────────────────────────────────────
async function getMemberByPhone(phone) {
  try {
    const res = await api.get('/internal/ussd/members/by-phone', { params: { phone } });
    return unwrap(res);
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ── Get USSD-optimised balance summary (Fabric via API) ──────────────────────
async function getUssdBalance(memberId) {
  const res = await api.get(`/internal/ussd/members/${memberId}/ussd-balance`);
  return unwrap(res);
}

// ── Get mini-statement (last 5 transactions) ─────────────────────────────────
async function getMiniStatement(memberId) {
  const res = await api.get(`/internal/ussd/members/${memberId}/ussd-mini-statement`);
  return unwrap(res);
}

// ── Get savings balance ───────────────────────────────────────────────────────
async function getBalance(memberId) {
  const res = await api.get(`/internal/ussd/members/${memberId}/balance`);
  return unwrap(res);
}

// ── Get active loan for a member ──────────────────────────────────────────────
async function getActiveLoan(memberId) {
  const res   = await api.get(`/internal/ussd/members/${memberId}/loans`);
  const loans = unwrap(res) || [];
  return loans.find(l => ['PENDING', 'APPROVED', 'DISBURSED'].includes(l.status)) || null;
}

// ── Get disbursed loan (for repayments) ──────────────────────────────────────
async function getDisbursedLoan(memberId) {
  const res   = await api.get(`/internal/ussd/members/${memberId}/loans`);
  const loans = unwrap(res) || [];
  return loans.find(l => l.status === 'DISBURSED') || null;
}

// ── Apply for loan ────────────────────────────────────────────────────────────
async function applyForLoan(memberId, amount, termMonths, purpose) {
  const res = await api.post('/internal/ussd/loans', { memberId, amount, termMonths, purpose });
  return unwrap(res);
}

// ── Record loan repayment ─────────────────────────────────────────────────────
async function repayLoan(loanId, amount, reference) {
  const res = await api.post(`/internal/ussd/loans/${loanId}/repay`, {
    amount, reference, channel: 'USSD',
  });
  return unwrap(res);
}

// ── Get loan policy (for display to users) ────────────────────────────────────
async function getLoanPolicy() {
  const res = await api.get('/loans/policy');
  return unwrap(res);
}

// ── Health check ──────────────────────────────────────────────────────────────
async function checkBackendHealth() {
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
  repayLoan,
  getLoanPolicy,
  checkBackendHealth,
};
