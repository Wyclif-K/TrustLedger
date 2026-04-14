// =============================================================================
// TrustLedger - Auth Service
// Handles JWT creation/verification and password hashing.
// =============================================================================

'use strict';

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const config   = require('../config');
const prisma   = require('./db.service');
const logger   = require('../config/logger');

const SALT_ROUNDS = 12;

// ─── Password ─────────────────────────────────────────────────────────────────
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub:      user.id,
      memberId: user.memberId,
      role:     user.role,
      email:    user.email,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

// ─── Session Management ───────────────────────────────────────────────────────
async function createSession(userId, refreshToken, ipAddress, deviceInfo) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.session.create({
    data: { userId, refreshToken, ipAddress, deviceInfo, expiresAt },
  });
}

async function revokeSession(refreshToken) {
  return prisma.session.updateMany({
    where: { refreshToken },
    data:  { isRevoked: true },
  });
}

async function revokeAllUserSessions(userId) {
  return prisma.session.updateMany({
    where: { userId },
    data:  { isRevoked: true },
  });
}

async function findValidSession(refreshToken) {
  return prisma.session.findFirst({
    where: {
      refreshToken,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(email, password, ipAddress, deviceInfo) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error('Invalid email or password.');
  if (user.status !== 'ACTIVE') throw new Error('Account is suspended. Contact support.');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new Error('Invalid email or password.');

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  });

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);
  await createSession(user.id, refreshToken, ipAddress, deviceInfo);

  return {
    accessToken,
    refreshToken,
    user: {
      id:       user.id,
      memberId: user.memberId,
      email:    user.email,
      fullName: user.fullName,
      role:     user.role,
    },
  };
}

// ─── Refresh Token ────────────────────────────────────────────────────────────
async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw new Error('Invalid or expired refresh token.');
  }

  if (payload.type !== 'refresh') throw new Error('Token type mismatch.');

  const session = await findValidSession(refreshToken);
  if (!session) throw new Error('Session not found or revoked.');

  const newAccessToken = generateAccessToken(session.user);
  return { accessToken: newAccessToken };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  createSession,
  revokeSession,
  revokeAllUserSessions,
  login,
  refreshAccessToken,
};
