// =============================================================================
// TrustLedger USSD - Loan Repayment Handler
// Menu option 5: Multi-step repayment flow
//
// Flow steps:
//   amount   → member enters payment amount (pre-filled with monthly instalment)
//   confirm  → member confirms the repayment details
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const session  = require('../services/session.service');
const { responses, end, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');
const { sms }  = require('../services/sms.service');

/**
 * Entry point — called when user selects option 5 from main menu.
 * Finds the active disbursed loan before starting the flow.
 */
async function startRepayment(sessionId, sess) {
  let loan;
  try {
    loan = await backend.getDisbursedLoan(sess.memberId);
  } catch (err) {
    logger.error('Repayment: loan lookup failed:', err.message);
    return MENUS.ERROR_GENERIC;
  }

  if (!loan) {
    return end('No active loan found\nfor repayment.\nDial *234# to check\nloan status.');
  }

  await session.updateSession(sessionId, {
    flow: 'REPAYMENT',
    step: 'amount',
    data: {
      loanId:           loan.loanId,
      outstandingBalance: loan.outstandingBalance,
      monthlyInstalment:  loan.monthlyInstalment,
    },
  });

  return responses.repayAskAmount(loan.outstandingBalance, loan.monthlyInstalment);
}

/**
 * Handles each step of the repayment flow.
 */
async function handleRepayment(sessionId, sess, input, phone) {
  const { step, data = {} } = sess;

  // ── Step 1: Amount ─────────────────────────────────────────────────────────
  if (step === 'amount') {
    const amount = parseFloat(input.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      return responses.repayAskAmount(data.outstandingBalance, data.monthlyInstalment);
    }

    if (amount > data.outstandingBalance) {
      return end(
        `Amount exceeds\noutstanding balance.\nMax: UGX ${Math.round(data.outstandingBalance / 1000)}K\n\nDial *234# to retry.`
      );
    }

    await session.updateSession(sessionId, {
      step: 'confirm',
      data: { ...data, repayAmount: amount },
    });

    return responses.repayConfirm(amount, data.loanId, data.outstandingBalance);
  }

  // ── Step 2: Confirm ────────────────────────────────────────────────────────
  if (step === 'confirm') {
    await session.deleteSession(sessionId);

    if (input !== '1') {
      return end('Repayment cancelled.\nDial *234# to retry.');
    }

    const reference = `USSD-${Date.now()}`;

    try {
      const result = await backend.repayLoan(data.loanId, data.repayAmount, reference);

      logger.info(
        `Repayment: ${sess.memberId} → ${data.loanId} ` +
        `UGX ${data.repayAmount} | outstanding: ${result.outstanding}`
      );

      // Send SMS confirmation (non-blocking)
      sms.loanRepaymentConfirmed(
        phone,
        data.repayAmount,
        result.outstanding,
        reference
      ).catch(() => {});

      return responses.repaySuccess(data.repayAmount, result.outstanding, reference);

    } catch (err) {
      logger.error('Repayment submission failed:', err.message);
      const apiMsg = err.response?.data?.message;
      if (apiMsg) {
        return end(`Repayment failed:\n${apiMsg.substring(0, 60)}`);
      }
      return MENUS.ERROR_GENERIC;
    }
  }

  // Unknown step
  await session.deleteSession(sessionId);
  return MENUS.ERROR_GENERIC;
}

module.exports = { startRepayment, handleRepayment };
