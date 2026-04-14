// =============================================================================
// TrustLedger USSD - Loan Application Handler
// Menu option 4: Multi-step loan application flow
//
// Flow steps:
//   amount   → member enters loan amount
//   term     → member selects repayment term (1-4)
//   purpose  → member types purpose text
//   confirm  → member confirms or cancels
// =============================================================================

'use strict';

const backend  = require('../services/backend.service');
const session  = require('../services/session.service');
const { responses, con, end, MENUS } = require('../utils/response.builder');
const logger   = require('../config/logger');
const { sms }  = require('../services/sms.service');

const TERM_MAP = { '1': 3, '2': 6, '3': 12, '4': 24 };

const MIN_AMOUNT = 100_000;
const MAX_AMOUNT = 50_000_000;

/**
 * Entry point — called when user selects option 4 from main menu.
 * Checks for an existing active loan before starting the flow.
 */
async function startLoanApplication(sessionId, sess) {
  // Block if member already has an active loan
  try {
    const existingLoan = await backend.getActiveLoan(sess.memberId);
    if (existingLoan) {
      return end(
        `You already have an\nactive loan.\nRef: ${existingLoan.loanId.slice(-10)}\nRepay it first.`
      );
    }
  } catch {}

  await session.updateSession(sessionId, { flow: 'LOAN_APPLY', step: 'amount', data: {} });
  return responses.loanAskAmount();
}

/**
 * Handles each step of the loan application flow.
 */
async function handleLoanApplication(sessionId, sess, input, phone) {
  const { step, data = {} } = sess;

  // ── Step 1: Amount ─────────────────────────────────────────────────────────
  if (step === 'amount') {
    const amount = parseFloat(input.replace(/,/g, ''));

    if (isNaN(amount) || amount < MIN_AMOUNT) {
      return con(`Amount too low.\nMin: UGX ${(MIN_AMOUNT / 1000).toFixed(0)}K\n\nEnter amount\n(UGX):`);
    }
    if (amount > MAX_AMOUNT) {
      return con(`Amount too high.\nMax: UGX ${(MAX_AMOUNT / 1_000_000).toFixed(0)}M\n\nEnter amount\n(UGX):`);
    }

    await session.updateSession(sessionId, { step: 'term', data: { ...data, amount } });
    return responses.loanAskTerm();
  }

  // ── Step 2: Term ───────────────────────────────────────────────────────────
  if (step === 'term') {
    const termMonths = TERM_MAP[input];
    if (!termMonths) {
      return con('Invalid choice.\nEnter 1-4:\n1. 3 months\n2. 6 months\n3. 12 months\n4. 24 months');
    }

    await session.updateSession(sessionId, { step: 'purpose', data: { ...data, termMonths } });
    return responses.loanAskPurpose();
  }

  // ── Step 3: Purpose ────────────────────────────────────────────────────────
  if (step === 'purpose') {
    const purpose = input.trim();
    if (purpose.length < 4) {
      return con('Purpose too short.\nPlease describe\nthe loan purpose:');
    }

    // Fetch policy to calculate financials for the confirm screen
    let monthlyInstalment = 0;
    let totalRepayable    = 0;
    try {
      const policy = await backend.getLoanPolicy();
      const interest    = data.amount * policy.INTEREST_RATE_MONTHLY * data.termMonths;
      const fee         = data.amount * policy.PROCESSING_FEE_RATE;
      totalRepayable    = data.amount + interest + fee;
      monthlyInstalment = Math.ceil(totalRepayable / data.termMonths);
    } catch {
      // If policy fetch fails, show estimate
      monthlyInstalment = Math.ceil(data.amount * 1.015 * data.termMonths / data.termMonths);
      totalRepayable    = monthlyInstalment * data.termMonths;
    }

    await session.updateSession(sessionId, {
      step: 'confirm',
      data: { ...data, purpose, monthlyInstalment, totalRepayable },
    });

    return responses.loanConfirm(data.amount, data.termMonths, monthlyInstalment, totalRepayable);
  }

  // ── Step 4: Confirm ────────────────────────────────────────────────────────
  if (step === 'confirm') {
    await session.deleteSession(sessionId);

    if (input !== '1') {
      return end('Loan application\ncancelled.\nDial *234# to start\nagain.');
    }

    try {
      const result = await backend.applyForLoan(
        sess.memberId,
        data.amount,
        data.termMonths,
        data.purpose
      );

      logger.info(`Loan applied: ${sess.memberId} → ${result.loanId} UGX ${data.amount}`);

      // Send SMS confirmation (non-blocking)
      sms.loanApplicationReceived(phone, result.loanId, data.amount).catch(() => {});

      return responses.loanSubmitted(result.loanId);

    } catch (err) {
      logger.error('Loan application submission failed:', err.message);
      const apiMsg = err.response?.data?.message;
      if (apiMsg) {
        // Show the first 60 chars of the API error to the user
        return end(`Application failed:\n${apiMsg.substring(0, 60)}`);
      }
      return MENUS.ERROR_GENERIC;
    }
  }

  // Unknown step — reset
  await session.deleteSession(sessionId);
  return MENUS.ERROR_GENERIC;
}

module.exports = { startLoanApplication, handleLoanApplication };
