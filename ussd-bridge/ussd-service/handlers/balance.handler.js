// =============================================================================
// TrustLedger USSD - Balance Handler
// Menu option 1: Check Balance
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const { responses, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');

/**
 * Handles the "Check Balance" menu option.
 * Single-step — no sub-menu needed.
 *
 * @param {object} session  - Current session state
 * @param {string} phone    - Caller's phone number
 * @returns {string}        - USSD response string (END)
 */
async function handleBalance(session, phone) {
  try {
    const memberId = session.memberId;
    const data = await backend.getUssdBalance(memberId);

    // Fire-and-forget SMS confirmation (don't block response)
    const { sms } = require('../services/sms.service');
    sms.balanceEnquiry(phone, data.balance, data.loanBalance).catch(() => {});

    logger.info(`Balance check: ${memberId} → UGX ${data.balance}`);

    return responses.balance(
      memberId,
      data.balance,
      data.loanBalance,
      data.nextDueDate
    );

  } catch (err) {
    logger.error('Balance handler error:', err.message);
    return MENUS.ERROR_GENERIC;
  }
}

module.exports = { handleBalance };
