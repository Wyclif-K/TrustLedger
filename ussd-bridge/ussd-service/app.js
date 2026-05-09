// =============================================================================
// TrustLedger USSD Service - Express App
// =============================================================================

'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const morgan     = require('morgan');

const config  = require('./config');
const logger  = require('./config/logger');
const {
  requestLogger, validateUssdPayload,
  ipWhitelist, errorHandler, notFound,
} = require('./middleware');
const { routeUssdRequest } = require('./handlers/router');
const sessionStore = require('./services/session.service');
const backend      = require('./services/backend.service');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: false })); // USSD service is internal — no browser CORS needed

// ── Rate limit (per IP) ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
  message:  { success: false, message: 'Too many requests.' },
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Africa's Talking sends URL-encoded form data for USSD webhooks
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(requestLogger);
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const [redisStatus, backendStatus] = await Promise.all([
    sessionStore.ping(),
    backend.checkBackendHealth(),
  ]);

  res.json({
    success:   true,
    service:   'TrustLedger USSD Bridge',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    redis:     redisStatus,
    backend:   backendStatus.ok ? 'connected' : `error: ${backendStatus.error}`,
  });
});

// ── GET /ussd — ping / browser (Africa's Talking sends POST only for live USSD) ─
app.get('/ussd', (req, res) => {
  res.type('text/plain');
  res.status(200).send(
    'TrustLedger USSD webhook OK. Live traffic uses POST with url-encoded sessionId, phoneNumber, text.',
  );
});

// ── USSD webhook (Africa's Talking / MTN / Airtel) ────────────────────────────
app.post('/ussd',
  ipWhitelist,
  validateUssdPayload,
  async (req, res) => {
    const { sessionId, phoneNumber, text = '', networkCode } = req.body;

    logger.info(`↓ USSD: session=${sessionId} phone=${phoneNumber} net=${networkCode} text="${text}"`);

    let response;
    try {
      response = await routeUssdRequest({ sessionId, phoneNumber, text });
    } catch (err) {
      logger.error('Router threw unhandled error:', err.message);
      response = 'END Service error. Please try again.';
    }

    logger.info(`↑ USSD: ${response.substring(0, 80)}${response.length > 80 ? '…' : ''}`);

    // USSD responses must be plain text — never JSON
    res.set('Content-Type', 'text/plain');
    res.send(response);
  }
);

// ── Session debug (admin-only, disable in production) ─────────────────────────
if (config.isDev) {
  app.get('/debug/session/:sessionId', async (req, res) => {
    const sess = await sessionStore.getSession(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, session: sess });
  });
}

// ── 404 + error handlers ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
