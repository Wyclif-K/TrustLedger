// =============================================================================
// TrustLedger USSD - Savings Deposit Handler
// Menu option 6: Member enters amount and submits for admin approval.
// No mobile money verification — administrators approve before blockchain.
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const session  = require('../services/session.service');
const { responses, con, end, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');

const MIN_AMOUNT = 1_000;
const MAX_AMOUNT = 50_000_000;

async function startSavingsDeposit(sessionId, sess) {
  await session.updateSession(sessionId, { flow: 'SAVINGS_DEPOSIT', step: 'amount', data: {} });
  return responses.savingsAskAmount();
}

async function handleSavingsDeposit(sessionId, sess, input, phone) {
  const { step, data = {} } = sess;

  if (step === 'amount') {
    const amount = parseFloat(input.replace(/,/g, ''));

    if (isNaN(amount) || amount < MIN_AMOUNT) {
      return con(`Amount too low.\nMin: UGX ${(MIN_AMOUNT / 1000).toFixed(0)}K\n\nEnter amount\n(UGX):`);
    }
    if (amount > MAX_AMOUNT) {
      return con(`Amount too high.\nMax: UGX ${(MAX_AMOUNT / 1_000_000).toFixed(0)}M\n\nEnter amount\n(UGX):`);
    }

    await session.updateSession(sessionId, { step: 'confirm', data: { ...data, amount } });
    return responses.savingsConfirm(amount);
  }

  if (step === 'confirm') {
    await session.deleteSession(sessionId);

    if (input !== '1') {
      return end('Deposit cancelled.\nDial *384*13948#\nto start again.');
    }

    const reference = `USSD-SAV-${Date.now()}`;

    try {
      const result = await backend.submitSavingsRequest(sess.memberId, data.amount, reference);

      logger.info(`Savings request: ${sess.memberId} UGX ${data.amount} ref ${result.reference}`);

      return responses.savingsSubmitted(result.reference);

    } catch (err) {
      logger.error('Savings request failed:', err.message);
      const apiMsg = err.response?.data?.message;
      if (apiMsg) return end(`Request failed:\n${apiMsg.substring(0, 60)}`);
      return MENUS.ERROR_GENERIC;
    }
  }

  await session.deleteSession(sessionId);
  return MENUS.ERROR_GENERIC;
}

module.exports = { startSavingsDeposit, handleSavingsDeposit };
