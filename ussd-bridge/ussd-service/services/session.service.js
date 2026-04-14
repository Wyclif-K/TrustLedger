// =============================================================================
// TrustLedger USSD Service - Redis Session Store
//
// USSD sessions are inherently stateless at the carrier level — every new
// USSD request carries a session ID. We use Redis (with a short TTL that
// mirrors the carrier's own session timeout) to store multi-step flow state
// between successive requests in the same session.
//
// Session shape:
//   {
//     phone:    '+256700123456',
//     memberId: 'MEM001',           // resolved on first use, cached
//     flow:     'LOAN_APPLY',       // current multi-step flow name
//     step:     'amount',           // current step within the flow
//     data:     { amount, termMonths, purpose, loanId, ... }
//   }
// =============================================================================

'use strict';

const { createClient } = require('redis');
const config = require('../config');
const logger = require('../config/logger');

let client = null;
let connected = false;
let memoryFallbackLogged = false;

// ── Fallback in-memory store when Redis is unavailable (dev/test) ─────────────
const memStore = new Map();

function logMemoryFallbackOnce(message) {
  if (memoryFallbackLogged) return;
  memoryFallbackLogged = true;
  logger.warn(message);
}

async function teardownRedis() {
  if (!client) return;
  const c = client;
  client = null;
  connected = false;
  try {
    c.removeAllListeners();
  } catch (_) {
    /* ignore */
  }
  try {
    await c.disconnect();
  } catch (_) {
    /* ignore */
  }
}

async function connect() {
  if (connected) return;

  if (!config.redis.enabled) {
    logger.info('Redis disabled (REDIS_ENABLED=false) — using in-memory USSD session store.');
    return;
  }

  try {
    client = createClient({
      url: config.redis.url,
      socket: {
        // Default strategy reconnects forever; each attempt emits `error` → log spam.
        reconnectStrategy: () => false,
      },
    });

    client.on('error', (err) => {
      connected = false;
      logMemoryFallbackOnce(`Redis error — using in-memory session store: ${err.message}`);
      void teardownRedis();
    });

    client.on('connect', () => {
      logger.info('Redis connected — USSD sessions backed by Redis');
      connected = true;
    });

    await client.connect();
    connected = true;
  } catch (err) {
    logMemoryFallbackOnce(`Redis unavailable (${err.message}). Using in-memory session store.`);
    await teardownRedis();
  }
}

async function disconnect() {
  await teardownRedis();
}

// ── Session key ───────────────────────────────────────────────────────────────
const key = (sessionId) => `ussd:session:${sessionId}`;

// ── Get session ───────────────────────────────────────────────────────────────
async function getSession(sessionId) {
  try {
    if (client && connected) {
      const raw = await client.get(key(sessionId));
      return raw ? JSON.parse(raw) : null;
    }
  } catch (err) {
    logger.error('Redis getSession error:', err.message);
  }
  // Fallback to in-memory
  return memStore.get(sessionId) || null;
}

// ── Set session (resets TTL) ──────────────────────────────────────────────────
async function setSession(sessionId, data) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  try {
    if (client && connected) {
      await client.setEx(key(sessionId), config.redis.sessionTtl, JSON.stringify(payload));
      return;
    }
  } catch (err) {
    logger.error('Redis setSession error:', err.message);
  }
  // Fallback to in-memory with manual TTL cleanup
  memStore.set(sessionId, payload);
  setTimeout(() => memStore.delete(sessionId), config.redis.sessionTtl * 1000);
}

// ── Update session (merge fields) ─────────────────────────────────────────────
async function updateSession(sessionId, updates) {
  const existing = await getSession(sessionId) || {};
  await setSession(sessionId, { ...existing, ...updates });
}

// ── Delete session ────────────────────────────────────────────────────────────
async function deleteSession(sessionId) {
  try {
    if (client && connected) {
      await client.del(key(sessionId));
      return;
    }
  } catch (err) {
    logger.error('Redis deleteSession error:', err.message);
  }
  memStore.delete(sessionId);
}

// ── Health check ──────────────────────────────────────────────────────────────
async function ping() {
  try {
    if (client && connected) {
      await client.ping();
      return { status: 'redis', connected: true };
    }
  } catch {}
  return { status: 'memory', connected: false };
}

module.exports = { connect, disconnect, getSession, setSession, updateSession, deleteSession, ping };
