// =============================================================================
// TrustLedger - Auth Middleware
// Verifies JWT on every protected route and enforces role-based access.
// =============================================================================

'use strict';

const authService = require('../services/auth.service');
const { sendError } = require('../utils/response');
const logger = require('../config/logger');

// ─── Authenticate ─────────────────────────────────────────────────────────────
/**
 * Extracts and verifies the JWT from the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication required. Provide a Bearer token.');
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = authService.verifyToken(token);
    next();
  } catch (err) {
    logger.warn('JWT verification failed:', err.message);
    return sendError(res, 401, 'Invalid or expired token.');
  }
}

// ─── Authorize (RBAC) ─────────────────────────────────────────────────────────
/**
 * Checks that the authenticated user's role is in the allowed list.
 * Usage: authorize('ADMIN', 'SUPER_ADMIN')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Forbidden: ${req.user.role} attempted ${req.method} ${req.path}`);
      return sendError(res, 403, `Access denied. Required role(s): ${allowedRoles.join(', ')}.`);
    }
    next();
  };
}

// ─── Self or Admin ────────────────────────────────────────────────────────────
/**
 * Allows the request if the user is accessing their own resource
 * OR if they have ADMIN/SUPER_ADMIN role.
 * Param key defaults to 'memberId'.
 */
function selfOrAdmin(paramKey = 'memberId') {
  return (req, res, next) => {
    const targetId = req.params[paramKey];
    const isSelf   = req.user.memberId === targetId;
    const isAdmin  = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

    if (!isSelf && !isAdmin) {
      return sendError(res, 403, 'You can only access your own resources.');
    }
    next();
  };
}

module.exports = { authenticate, authorize, selfOrAdmin };
