// =============================================================================
// TrustLedger - Prisma DB Client (singleton)
// =============================================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const logger = require('../config/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

module.exports = prisma;
