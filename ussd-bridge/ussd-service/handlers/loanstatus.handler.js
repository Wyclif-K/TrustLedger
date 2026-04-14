// =============================================================================
// TrustLedger USSD - Loan Status Handler
// Menu option 3: View active loan status
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const { responses, end, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');

async function handleLoanStatus(session) {
  try {
    const loan = await backend.getActiveLoan(session.memberId);

    if (!loan) {
      return end('No active loans found.\nDial back and choose\noption 4 to apply.');
    }

    logger.info(`Loan status: ${session.memberId} → ${loan.loanId} [${loan.status}]`);
    return responses.loanStatus(loan);

  } catch (err) {
    logger.error('Loan status handler error:', err.message);
    return MENUS.ERROR_GENERIC;
  }
}

module.exports = { handleLoanStatus };
