// =============================================================================
// USSD bridge — environment
// =============================================================================

'use strict';

require('dotenv').config();

function optional(key, fallback) {
  return process.env[key] || fallback;
}

function parseInt10(key, fallback) {
  const n = parseInt(optional(key, String(fallback)), 10);
  return Number.isNaN(n) ? fallback : n;
}

module.exports = {
  env:   optional('NODE_ENV', 'development'),
  port:  parseInt10('PORT', 4000),
  isDev: optional('NODE_ENV', 'development') === 'development',

  backend: {
    apiUrl: optional('BACKEND_API_URL', 'http://localhost:3000/api/v1'),
    apiKey: optional('BACKEND_API_KEY', ''),
  },

  africastalking: {
    username:  optional('AT_USERNAME', 'sandbox'),
    apiKey:    optional('AT_API_KEY', ''),
    shortcode: optional('AT_SHORTCODE', '*234#'),
  },

  redis: {
    url:        optional('REDIS_URL', 'redis://localhost:6379'),
    /** When false, skip Redis entirely (in-memory sessions only). */
    enabled:    optional('REDIS_ENABLED', 'true').toLowerCase() !== 'false',
    sessionTtl: parseInt10('REDIS_SESSION_TTL', 120),
  },

  rateLimit: {
    windowMs: parseInt10('RATE_LIMIT_WINDOW_MS', 60_000),
    max:      parseInt10('RATE_LIMIT_MAX', 200),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
  },
};
