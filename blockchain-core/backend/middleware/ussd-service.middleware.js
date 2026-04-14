// =============================================================================
// USSD bridge — shared secret (X-Service-Key). Treat as full trust; only call
// from the USSD microservice on a private network.
// =============================================================================

'use strict';

const crypto = require('crypto');
const config = require('../config');
const { sendError } = require('../utils/response');

function timingSafeEqualString(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/**
 * Sets req.user as SUPER_ADMIN so existing member/loan handlers authorize.
 */
function requireUssdServiceKey(req, res, next) {
  const expected = config.ussdService.key;
  if (!expected) {
    return sendError(res, 503, 'USSD bridge is not configured (set USSD_SERVICE_KEY on the API).');
  }
  const provided = req.headers['x-service-key'] || req.headers['X-Service-Key'] || '';
  if (!timingSafeEqualString(provided, expected)) {
    return sendError(res, 403, 'Invalid or missing service key.');
  }
  req.user = {
    id:       'ussd-bridge',
    memberId: 'SYSTEM',
    role:     'SUPER_ADMIN',
    email:    'ussd-bridge@internal',
  };
  next();
}

module.exports = { requireUssdServiceKey };
