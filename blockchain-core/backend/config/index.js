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

function parseCorsOrigin() {
  const raw = optional('CORS_ORIGIN', 'http://localhost:5173');
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return raw;
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
};

if (fabricEnabled) {
  fabric.tlsCertPath = stripEnvQuotes(required('FABRIC_TLS_CERT_PATH'));
  fabric.certPath = stripEnvQuotes(required('FABRIC_CERT_PATH'));
  fabric.keyDir = stripEnvQuotes(required('FABRIC_KEY_DIR'));
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

const config = {
  env:     optional('NODE_ENV', 'development'),
  port:    parseInt(optional('PORT', '3000'), 10),
  apiPrefix: optional('API_PREFIX', '/api/v1'),
  isDev:   optional('NODE_ENV', 'development') === 'development',
  isProd:  optional('NODE_ENV', 'development') === 'production',

  jwt: {
    secret:             required('JWT_SECRET'),
    expiresIn:        optional('JWT_EXPIRES_IN', '8h'),
    refreshExpiresIn:   optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  fabric,

  africasTalking,

  /** Shared secret for ussd-bridge → API (header X-Service-Key). Empty = internal routes disabled. */
  ussdService: {
    key: stripEnvQuotes(optional('USSD_SERVICE_KEY', '')).trim(),
  },

  /** Dev recovery: POST /members/:memberId/purge-ledger (chaincode purgeLedgerMember). */
  ledger: {
    allowMemberPurge:
      String(optional('ALLOW_LEDGER_MEMBER_PURGE', 'false')).toLowerCase() === 'true',
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max:      parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
  },

  cors: {
    origin: parseCorsOrigin(),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir:   optional('LOG_DIR', './logs'),
  },
};

module.exports = config;
