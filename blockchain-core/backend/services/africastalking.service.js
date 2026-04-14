// =============================================================================
// Africa's Talking — credential check and SMS (API key + username from .env)
// USSD callbacks do not require these for the HTTP handler; they are used to
// verify your app credentials and to send SMS when you call sendSms().
// =============================================================================

'use strict';

const config = require('../config');
const logger = require('../config/logger');

function apiBase() {
  return config.africasTalking.apiBaseUrl || 'https://api.africastalking.com';
}

function isConfigured() {
  return !!(config.africasTalking?.username && config.africasTalking?.apiKey);
}

/**
 * Validates AT_USERNAME + AT_API_KEY against the User API (one-off / startup).
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function validateCredentials() {
  if (!isConfigured()) {
    return { ok: false, message: 'AT_USERNAME and AT_API_KEY not both set in .env' };
  }
  const { username, apiKey } = config.africasTalking;
  if (!apiKey || apiKey.length < 8) {
    return { ok: false, message: 'AT_API_KEY is missing or too short — paste the full key from the Sandbox app in Africa\'s Talking.' };
  }

  const base = apiBase();
  const url = `${base}/version1/user?username=${encodeURIComponent(username)}`;
  try {
    const res = await fetch(url, {
      method:  'GET',
      headers: {
        Accept:      'application/json',
        apiKey,
        'User-Agent': 'TrustLedgerBackend/1.0 (Node.js)',
      },
    });
    const rawText = await res.text();
    let data = {};
    try {
      if (rawText) data = JSON.parse(rawText);
    } catch {
      /* AT often returns plain text, e.g. "The supplied authentication is invalid" */
    }
    if (!res.ok) {
      const msg =
        data.errorMessage ||
        data.message ||
        rawText.trim().replace(/\s+/g, ' ') ||
        `${res.status} ${res.statusText}`;
      return { ok: false, message: String(msg) };
    }
    return {
      ok:      true,
      message: `Africa's Talking user "${username}" OK (${base.includes('sandbox') ? 'sandbox' : 'live'} API)`,
    };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  }
}

/**
 * Send SMS (production or sandbox, depending on username).
 * @param {string|string[]} to E.164 or local digits as AT accepts
 * @param {string} message
 */
async function sendSms(to, message) {
  if (!isConfigured()) {
    const err = new Error('Africa\'s Talking is not configured (AT_USERNAME, AT_API_KEY).');
    err.statusCode = 503;
    throw err;
  }
  const { username, apiKey, shortCode, smsFrom } = config.africasTalking;
  const recipients = Array.isArray(to) ? to : [to];
  /** USSD dial strings (*384#) are not SMS sender IDs. */
  const from =
    (shortCode && !/[*#]/.test(shortCode) ? shortCode : null) || smsFrom || '';
  const body = new URLSearchParams({ username, to: recipients.join(','), message });
  if (from) body.set('from', from);

  const res = await fetch(`${apiBase()}/version1/messaging`, {
    method:  'POST',
    headers: {
      Accept:         'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey,
      'User-Agent':   'TrustLedgerBackend/1.0 (Node.js)',
    },
    body: body.toString(),
  });
  const rawText = await res.text();
  let data = {};
  try {
    if (rawText) data = JSON.parse(rawText);
  } catch { /* plain-text errors */ }
  if (!res.ok) {
    const msg =
      data.errorMessage ||
      data.message ||
      rawText.trim().replace(/\s+/g, ' ') ||
      `${res.status} ${res.statusText}`;
    logger.warn(`Africa's Talking SMS failed: ${msg}`);
    const err = new Error(String(msg));
    err.statusCode = 502;
    throw err;
  }
  return data;
}

module.exports = {
  isConfigured,
  validateCredentials,
  sendSms,
};
