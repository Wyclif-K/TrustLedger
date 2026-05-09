// =============================================================================
// TrustLedger USSD Service - Middleware
// =============================================================================

'use strict';

const logger = require('../config/logger');

// ── Request logger ────────────────────────────────────────────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms    = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms ip=${req.ip}`);
  });
  next();
}

// ── Normalise Africa's Talking body keys (some gateways use different casing) ─
function normalizeAtUssdBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();
  const b = req.body;
  const sessionId = b.sessionId ?? b.SessionId;
  const phoneNumber = b.phoneNumber ?? b.PhoneNumber;
  const text = b.text ?? b.Text ?? '';
  if (sessionId != null && sessionId !== '') b.sessionId = String(sessionId).trim();
  if (phoneNumber != null && phoneNumber !== '') b.phoneNumber = String(phoneNumber).trim();
  b.text = text === undefined || text === null ? '' : String(text);
  next();
}

// ── USSD payload validator ────────────────────────────────────────────────────
// Africa's Talking sends sessionId, serviceCode, phoneNumber, and text.
// Reject any request missing required fields early.
function validateUssdPayload(req, res, next) {
  const { sessionId, phoneNumber } = req.body;

  if (!sessionId || !phoneNumber) {
    logger.warn('Invalid USSD payload — missing sessionId or phoneNumber', req.body);
    res.set('Content-Type', 'text/plain');
    /** Africa's Talking treats non-200 as failure → generic "network error" in simulator */
    return res.status(200).send('END Invalid request.');
  }

  // Normalise phone: ensure it starts with +
  if (!req.body.phoneNumber.startsWith('+')) {
    req.body.phoneNumber = `+${req.body.phoneNumber}`;
  }

  next();
}

// ── IP whitelist (Africa's Talking gateway IPs) ───────────────────────────────
// In production, restrict USSD endpoint to AT's known IPs.
// Set WHITELIST_ENABLED=true in .env and AT_GATEWAY_IPS to comma-separated IPs.
const AT_IPS = (process.env.AT_GATEWAY_IPS || '').split(',').filter(Boolean);

function ipWhitelist(req, res, next) {
  if (process.env.WHITELIST_ENABLED !== 'true' || AT_IPS.length === 0) {
    return next(); // Disabled in dev
  }

  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const allowed  = AT_IPS.some(ip => clientIp.includes(ip.trim()));

  if (!allowed) {
    logger.warn(`Blocked request from IP: ${clientIp}`);
    res.set('Content-Type', 'text/plain');
    return res.status(200).send('END Forbidden.');
  }

  next();
}

// ── Global error handler ──────────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err.message, err.stack);
  res.set('Content-Type', 'text/plain');
  /** USSD gateways often treat non-200 as complete failure → generic carrier error */
  res.status(200).send('END Service error. Please try again.');
}

// ── 404 handler ───────────────────────────────────────────────────────────────
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = {
  requestLogger,
  normalizeAtUssdBody,
  validateUssdPayload,
  ipWhitelist,
  errorHandler,
  notFound,
};
