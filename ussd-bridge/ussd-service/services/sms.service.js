// =============================================================================
// TrustLedger USSD Service - Africa's Talking SMS Service
//
// Sends SMS confirmation messages after USSD transactions complete.
// E.g. "Your loan repayment of UGX 90,000 has been received."
// =============================================================================

'use strict';

const config = require('../config');
const logger = require('../config/logger');

let smsClient = null;

function init() {
  try {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      username: config.africastalking.username,
      apiKey:   config.africastalking.apiKey,
    });
    smsClient = at.SMS;
    logger.info(`Africa's Talking SMS initialized (username: ${config.africastalking.username})`);
  } catch (err) {
    logger.warn(`Africa's Talking not available: ${err.message}. SMS will be logged only.`);
  }
}

// ── Format currency for SMS (short) ───────────────────────────────────────────
function fmt(amount) {
  const n = Number(amount);
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `UGX ${(n / 1_000).toFixed(0)}K`;
  return `UGX ${n.toLocaleString()}`;
}

// ── Send SMS (fire and forget — never blocks USSD response) ───────────────────
async function send(phone, message) {
  logger.info(`SMS → ${phone}: ${message}`);

  if (!smsClient) return; // Dev mode: just log

  try {
    await smsClient.send({
      to:      [phone],
      message: `TrustLedger SACCO: ${message}`,
      from:    config.africastalking.shortcode,
    });
  } catch (err) {
    // Non-critical — do not throw, just log
    logger.error(`SMS send failed to ${phone}: ${err.message}`);
  }
}

// ── Pre-built message templates ────────────────────────────────────────────────
const sms = {
  depositConfirmed: (amount, balance, ref) =>
    send(null, `Deposit of ${fmt(amount)} received. New balance: ${fmt(balance)}. Ref: ${ref}`),

  loanApplicationReceived: (phone, loanId, amount) =>
    send(phone, `Loan application for ${fmt(amount)} submitted. Ref: ${loanId.slice(-10)}. Await admin approval.`),

  loanRepaymentConfirmed: (phone, amount, outstanding, ref) =>
    send(phone, outstanding <= 0
      ? `Loan fully repaid! Amount: ${fmt(amount)}. Ref: ${ref}. Thank you.`
      : `Repayment of ${fmt(amount)} received. Outstanding: ${fmt(outstanding)}. Ref: ${ref}.`
    ),

  balanceEnquiry: (phone, balance, loanBalance) => {
    const msg = loanBalance > 0
      ? `Savings: ${fmt(balance)} | Loan due: ${fmt(loanBalance)}`
      : `Savings balance: ${fmt(balance)}`;
    return send(phone, msg);
  },

  loanApproved: (phone, amount, nextDue) =>
    send(phone, `Your loan of ${fmt(amount)} has been approved. Disbursement pending. Next repayment: ${nextDue}.`),

  custom: (phone, message) => send(phone, message),
};

module.exports = { init, send, sms };
