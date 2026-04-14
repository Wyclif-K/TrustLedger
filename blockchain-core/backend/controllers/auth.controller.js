// =============================================================================
// TrustLedger - Auth Controller
// Handles: login, logout, token refresh, password change, register member
// =============================================================================

'use strict';

const { body } = require('express-validator');
const authService    = require('../services/auth.service');
const fabricService  = require('../services/fabric.service');
const prisma         = require('../services/db.service');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');
const logger         = require('../config/logger');

// ─── Validators ───────────────────────────────────────────────────────────────
const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('password').notEmpty().withMessage('Password required.'),
];

const registerValidators = [
  body('memberId').notEmpty().trim().withMessage('Member ID required.'),
  body('fullName').notEmpty().trim().withMessage('Full name required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('phone').matches(/^\+?[0-9]{10,15}$/).withMessage('Valid phone number required.'),
  body('nationalId').notEmpty().trim().withMessage('National ID required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('role').optional().isIn(['MEMBER', 'ADMIN', 'AUDITOR']).withMessage('Invalid role.'),
];

const changePasswordValidators = [
  body('currentPassword').notEmpty().withMessage('Current password required.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
];

// ─── Register Member ──────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/register
 * Admin registers a new member on the blockchain AND in PostgreSQL.
 */
function isLedgerMemberMissingError(err) {
  const detailMsgs = Array.isArray(err.details)
    ? err.details.map((d) => d && d.message).filter(Boolean).join(' ')
    : '';
  const text = `${err.message || ''} ${detailMsgs} ${JSON.stringify(err.details || [])}`;
  return /No record found|not found for key/i.test(text);
}

async function register(req, res, next) {
  try {
    const { memberId, fullName, email, phone, nationalId, password, role = 'MEMBER' } = req.body;

    // 0. If this ID already exists on the ledger, fail fast with a clear message (avoids vague endorse errors)
    try {
      const existing = await fabricService.SavingsContract.evaluate('getMember', memberId);
      if (existing && typeof existing === 'object' && existing.memberId) {
        return sendError(
          res,
          409,
          `Member ID '${memberId}' is already registered on the blockchain. Use a different ID or remove the ledger record first.`
        );
      }
    } catch (checkErr) {
      if (!isLedgerMemberMissingError(checkErr)) {
        throw checkErr;
      }
    }

    // 1. Register on blockchain (SavingsContract)
    await fabricService.SavingsContract.submit(
      'registerMember',
      memberId, fullName, phone, nationalId, role.toLowerCase()
    );

    // 2. Create user record in PostgreSQL (auth credentials)
    const passwordHash = await authService.hashPassword(password);
    const user = await prisma.user.create({
      data: { memberId, fullName, email, phone, nationalId, passwordHash, role },
    });

    logger.info(`New member registered: ${memberId} (${email})`);

    return sendCreated(res, {
      memberId:   user.memberId,
      email:      user.email,
      fullName:   user.fullName,
      role:       user.role,
    }, 'Member registered successfully.');

  } catch (err) {
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const ipAddress  = req.ip;
    const deviceInfo = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, deviceInfo);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return sendSuccess(res, {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      user:         result.user,
    }, 'Login successful.');

  } catch (err) {
    if (err.message.includes('Invalid') || err.message.includes('suspended')) {
      return sendError(res, 401, err.message);
    }
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) await authService.revokeSession(refreshToken);
    res.clearCookie('refreshToken');
    return sendSuccess(res, {}, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) return sendError(res, 401, 'Refresh token required.');

    const result = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result, 'Token refreshed.');
  } catch (err) {
    return sendError(res, 401, err.message);
  }
}

// ─── Get Current User (me) ────────────────────────────────────────────────────
/**
 * GET /api/v1/auth/me
 */
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { id: true, memberId: true, email: true, fullName: true, role: true, lastLoginAt: true },
    });
    if (!user) return sendError(res, 404, 'User not found.');
    return sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────
/**
 * PUT /api/v1/auth/password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    const valid = await authService.verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return sendError(res, 401, 'Current password is incorrect.');

    const newHash = await authService.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash: newHash },
    });

    // Revoke all sessions — user must log in again
    await authService.revokeAllUserSessions(user.id);
    res.clearCookie('refreshToken');

    return sendSuccess(res, {}, 'Password changed. Please log in again.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  me,
  changePassword,
  loginValidators,
  registerValidators,
  changePasswordValidators,
};
