// =============================================================================
// TrustLedger - Configuration
// =============================================================================

'use strict';

require('dotenv').config();

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key, fallback) {
  return process.env[key] || fallback;
}

/** .env lines like KEY="C:/path" sometimes keep quotes depending on tooling; normalize paths. */
function stripEnvQuotes(val) {
  if (val == null || val === '') return val;
  const s = String(val).trim();
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** Always returns an explicit list used by cors + same-host Railway fallback */
function parseCorsOriginList() {
  const raw = optional('CORS_ORIGIN', 'http://localhost:5173');
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [raw];
}

function corsSameHostProductionFallbackEnabled() {
  return String(optional('CORS_SAMEHOST_FALLBACK', 'true')).toLowerCase() !== 'false';
}

function fabricEnabledFromEnv() {
  const v = String(optional('FABRIC_ENABLED', 'false')).toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

const fabricEnabled = fabricEnabledFromEnv();

const fabric = {
  enabled:        fabricEnabled,
  channelName:    stripEnvQuotes(optional('FABRIC_CHANNEL_NAME', 'trustledger-channel')),
  chaincodeName:  stripEnvQuotes(optional('FABRIC_CHAINCODE_NAME', 'trustledger')),
  mspId:          stripEnvQuotes(optional('FABRIC_MSP_ID', 'SaccoOrgMSP')),
  peerEndpoint:   stripEnvQuotes(optional('FABRIC_PEER_ENDPOINT', 'localhost:7051')),
  peerHostAlias:  stripEnvQuotes(optional('FABRIC_PEER_HOST_ALIAS', 'peer0.sacco.trustledger.com')),
  tlsCertPath:    '',
  certPath:       '',
  keyDir:         '',
  /** PEM strings from env (e.g. Railway) — alternative to files on disk */
  tlsCertPem:     '',
  certPem:        '',
  keyPem:         '',
  materialMode:   'none',
};

if (fabricEnabled) {
  const tlsPem = String(optional('FABRIC_TLS_CERT_PEM', '')).trim();
  const certPem = String(optional('FABRIC_CERT_PEM', '')).trim();
  const keyPem = String(optional('FABRIC_KEY_PEM', '')).trim();
  const pemCount = [tlsPem, certPem, keyPem].filter(Boolean).length;

  if (pemCount === 3) {
    fabric.tlsCertPem = tlsPem.replace(/\\n/g, '\n');
    fabric.certPem = certPem.replace(/\\n/g, '\n');
    fabric.keyPem = keyPem.replace(/\\n/g, '\n');
    fabric.materialMode = 'pem';
  } else if (pemCount === 0) {
    fabric.tlsCertPath = stripEnvQuotes(required('FABRIC_TLS_CERT_PATH'));
    fabric.certPath = stripEnvQuotes(required('FABRIC_CERT_PATH'));
    fabric.keyDir = stripEnvQuotes(required('FABRIC_KEY_DIR'));
    fabric.materialMode = 'path';
  } else {
    throw new Error(
      'Fabric credentials incomplete: set all of FABRIC_TLS_CERT_PEM, FABRIC_CERT_PEM, and FABRIC_KEY_PEM ' +
        '(recommended on Railway) or use FABRIC_TLS_CERT_PATH, FABRIC_CERT_PATH, and FABRIC_KEY_DIR for local files.'
    );
  }
}

const atUsername = stripEnvQuotes(optional('AT_USERNAME', '')).trim();
/** Strip newlines — pasted keys in .env sometimes break across lines. */
const atApiKey = stripEnvQuotes(optional('AT_API_KEY', ''))
  .trim()
  .replace(/\r?\n/g, '');
const atSandboxRaw = String(optional('AT_SANDBOX', '')).toLowerCase();

function africasTalkingApiBase(username, sandboxFlag) {
  if (sandboxFlag === 'true' || sandboxFlag === '1' || sandboxFlag === 'yes') {
    return 'https://api.sandbox.africastalking.com';
  }
  if (sandboxFlag === 'false' || sandboxFlag === '0' || sandboxFlag === 'no') {
    return 'https://api.africastalking.com';
  }
  /** Sandbox keys only validate on the sandbox host; live keys on the production host. */
  if (String(username).toLowerCase() === 'sandbox') {
    return 'https://api.sandbox.africastalking.com';
  }
  return 'https://api.africastalking.com';
}

const atSmsSavingsAlertsRaw = String(optional('AT_SMS_SAVINGS_ALERTS', 'true')).toLowerCase();

const africasTalking = {
  /** Both required for SMS API and startup validation; USSD webhook works without them. */
  configured: !!(atUsername && atApiKey),
  username:   atUsername,
  apiKey:     atApiKey,
  apiBaseUrl: africasTalkingApiBase(atUsername, atSandboxRaw),
  /** USSD service code (e.g. *384*123#) — for dashboard reference; not used as SMS sender. */
  shortCode: stripEnvQuotes(optional('AT_SHORTCODE', '')),
  /** Optional SMS sender ID / short code when AT_SHORTCODE is a USSD string */
  smsFrom:   stripEnvQuotes(optional('AT_SMS_FROM', '')),
  /** After admin deposit/withdraw, SMS member if AT is configured. Set false to disable. */
  smsSavingsAlerts: atSmsSavingsAlertsRaw !== 'false' && atSmsSavingsAlertsRaw !== '0',
};

function boolEnv(key, defaultVal) {
  const v = String(optional(key, defaultVal)).toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/** Split admin + API on different hosts (e.g. two Railway URLs): use `none` with HTTPS. Browsers require Secure when sameSite is none. */
function parseRefreshCookieSameSite() {
  const raw = String(optional('REFRESH_COOKIE_SAMESITE', 'strict')).toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
  return 'strict';
}

const refreshCookieSameSite = parseRefreshCookieSameSite();
const refreshCookieSecure =
  optional('NODE_ENV', 'development') === 'production' || refreshCookieSameSite === 'none';

const config = {
  env:     optional('NODE_ENV', 'development'),
  port:    parseInt(optional('PORT', '3000'), 10),
  apiPrefix: optional('API_PREFIX', '/api/v1'),
  isDev:   optional('NODE_ENV', 'development') === 'development',
  isProd:  optional('NODE_ENV', 'development') === 'production',

  /** When true (and dist exists), Express serves ../admin-dashboard/dist — same origin as the API. */
  serveAdmin: boolEnv('SERVE_ADMIN_STATIC', 'false'),

  jwt: {
    secret:             required('JWT_SECRET'),
    expiresIn:        optional('JWT_EXPIRES_IN', '8h'),
    refreshExpiresIn:   optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  /** httpOnly refresh cookie (login). For admin UI on a different origin than the API, set REFRESH_COOKIE_SAMESITE=none and CORS_ORIGIN to the admin URL. */
  auth: {
    refreshCookie: {
      sameSite: refreshCookieSameSite,
      secure:   refreshCookieSecure,
    },
  },

  fabric,

  africasTalking,

  /** Shared secret for ussd-bridge → API (header X-Service-Key). Empty = internal routes disabled. */
  ussdService: {
    key: stripEnvQuotes(optional('USSD_SERVICE_KEY', '')).trim(),
  },

  /**
   * Public HTTPS base of the USSD bridge microservice (no path). API probes GET {base}/health for the admin dashboard.
   * Example: https://your-ussd-bridge.up.railway.app — must match where ussd-service actually runs.
   */
  ussdBridge: {
    publicBaseUrl: stripEnvQuotes(optional('USSD_BRIDGE_PUBLIC_URL', '')).trim(),
  },

  /** Dev recovery: POST /members/:memberId/purge-ledger (chaincode purgeLedgerMember). */
  ledger: {
    allowMemberPurge:
      String(optional('ALLOW_LEDGER_MEMBER_PURGE', 'false')).toLowerCase() === 'true',
  },

  /** Only applied to /api/v1 (see app.js) — static admin files must not share this budget. */
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(
      optional('RATE_LIMIT_MAX', optional('NODE_ENV', 'development') === 'production' ? '10000' : '500'),
      10,
    ),
  },

  cors: {
    /** Explicit allowlist */
    allowedOriginList: parseCorsOriginList(),
    /** When NODE_ENV=production, also allow browser Origin if it matches Host (single Railway URL). Disable with CORS_SAMEHOST_FALLBACK=false. */
    sameHostProductionFallback: corsSameHostProductionFallbackEnabled(),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR', './logs'),
  },
};

module.exports = config;
