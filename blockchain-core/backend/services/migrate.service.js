// =============================================================================
// TrustLedger - Database migrations (Prisma)
// Runs on API startup so Railway/custom start commands still apply schema changes.
// =============================================================================

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const logger = require('../config/logger');
const prisma = require('./db.service');

function applyDatabaseMigrations() {
  if (process.env.NODE_ENV === 'test') return;
  if (String(process.env.SKIP_PRISMA_MIGRATE || '').toLowerCase() === 'true') {
    logger.warn('SKIP_PRISMA_MIGRATE=true — skipping prisma migrate deploy');
    return;
  }

  logger.info('Running prisma migrate deploy...');
  try {
    const out = execSync('npx prisma migrate deploy', {
      cwd:     path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio:   ['ignore', 'pipe', 'pipe'],
      env:     process.env,
    });
    if (out.trim()) logger.info(out.trim());
    logger.info('Prisma migrations up to date.');
  } catch (err) {
    const stdout = err.stdout?.toString?.() || '';
    const stderr = err.stderr?.toString?.() || '';
    logger.error('prisma migrate deploy failed', { stdout, stderr, message: err.message });
    throw new Error(
      `Database migration failed. ${(stderr || stdout || err.message).trim()} ` +
        'Check DATABASE_URL on the API host, then run: npx prisma migrate deploy'
    );
  }
}

/** Verify member_requests exists (savings/repayment queue). */
async function memberRequestsTableReady() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "member_requests" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

module.exports = { applyDatabaseMigrations, memberRequestsTableReady };
