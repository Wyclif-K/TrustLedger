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

// ── USSD payload validator ────────────────────────────────────────────────────
// Africa's Talking sends sessionId, serviceCode, phoneNumber, and text.
// Reject any request missing required fields early.
function validateUssdPayload(req, res, next) {
  const { sessionId, phoneNumber } = req.body;

  if (!sessionId || !phoneNumber) {
    logger.warn('Invalid USSD payload — missing sessionId or phoneNumber', req.body);
    res.set('Content-Type', 'text/plain');
    return res.status(400).send('END Invalid request.');
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
    return res.status(403).send('END Forbidden.');
  }

  next();
}

// ── Global error handler ──────────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err.message, err.stack);
  res.set('Content-Type', 'text/plain');
  res.status(500).send('END Service error. Please try again.');
}

// ── 404 handler ───────────────────────────────────────────────────────────────
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { requestLogger, validateUssdPayload, ipWhitelist, errorHandler, notFound };
