// =============================================================================
// TrustLedger - Express App
// =============================================================================

'use strict';

const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const config  = require('./config');
const routes  = require('./routes');
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware');
const logger  = require('./config/logger');

const app = express();

if (config.isProd) {
  app.set('trust proxy', 1);
}

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    /** Allow browsers to call this API from another origin (split admin + API); CORS still restricts which origins. */
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Single-URL deploy: browsers send Origin=https://your-app.up.railway.app while CORS_ORIGIN may still say localhost —
// allowing same hostname in production fixes that without weakening split-deploy (different admin vs API hostnames).
app.use((req, res, next) => cors({
  origin(origin, cb) {
    const list = config.cors.allowedOriginList;
    if (!origin) return cb(null, true);
    if (list.includes(origin)) return cb(null, true);
    if (
      config.isProd &&
      config.cors.sameHostProductionFallback &&
      /^https:/i.test(origin)
    ) {
      try {
        const u = new URL(origin);
        if (String(u.hostname).toLowerCase() === String(req.hostname || '').toLowerCase()) {
          return cb(null, true);
        }
      } catch (_) { /* noop */ }
    }
    cb(null, false);
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})(req, res, next));

// ─── Rate limiting (API only) ────────────────────────────────────────────────
// Global limiter consumed the admin SPA static budget (dozens of JS/CSS) + API → instant 429.
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  /** Mounted under apiPrefix; req.path is relative to mount (e.g. /health). */
  skip: (req) => req.path === '/health' || req.path === '/ussd',
});
app.use(config.apiPrefix, apiLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
// USSD providers POST as URL-encoded form data
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ──────────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(requestLogger);
}

function normalizeUssdMountPath(p) {
  const s = (p || '/ussd-bridge').trim();
  const withSlash = s.startsWith('/') ? s : `/${s}`;
  return withSlash.replace(/\/$/, '') || '/ussd-bridge';
}

const ussdMountPrefix = normalizeUssdMountPath(config.ussdBridge.mountPath);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use(config.apiPrefix, routes);

const ussdEmbedAppPath = path.join(__dirname, 'ussd-service', 'app.js');
if (config.ussdBridge.embed && fs.existsSync(ussdEmbedAppPath)) {
  setImmediate(async () => {
    try {
      const sessionStore = require('./ussd-service/services/session.service');
      await sessionStore.connect();
      require('./ussd-service/services/sms.service').init();
    } catch (err) {
      logger.warn(`USSD bridge embed init: ${err.message}`);
    }
  });
  const mountAt = ussdMountPrefix;
  const ussdApp = require('./ussd-service/app');
  app.use(mountAt, ussdApp);
  logger.info(`USSD bridge embedded at ${mountAt} (same origin as API)`);
} else if (config.ussdBridge.embed && !fs.existsSync(ussdEmbedAppPath)) {
  logger.warn('USSD_BRIDGE_EMBED is true but ./ussd-service is missing — skipping embed (check Docker COPY)');
}


// ─── Admin SPA (production: Railway Docker serves same origin) ────────────────
if (config.serveAdmin) {
  const adminDist = path.join(__dirname, '..', 'admin-dashboard', 'dist');
  const indexHtml = path.join(adminDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(adminDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith(config.apiPrefix)) return next();
      if (req.path.startsWith(ussdMountPrefix)) return next();
      res.sendFile(indexHtml, (err) => (err ? next(err) : undefined));
    });
  }
}

// ─── 404 & Error Handlers ────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
