// =============================================================================
// TrustLedger USSD - Mini Statement Handler
// Menu option 2: Last 5 transactions
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const { responses, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');

async function handleMiniStatement(session) {
  try {
    const data = await backend.getMiniStatement(session.memberId);
    logger.info(`Mini-statement: ${session.memberId} — ${data?.transactions?.length || 0} txs`);
    return responses.miniStatement(session.memberId, data?.transactions || []);
  } catch (err) {
    logger.error('Mini-statement handler error:', err.message);
    return MENUS.ERROR_GENERIC;
  }
}

module.exports = { handleMiniStatement };
