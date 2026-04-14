// =============================================================================
// TrustLedger USSD Service - Main Router / Session Engine
//
// Every USSD request arrives here. The router:
//   1. Resolves the member's identity from their phone number
//   2. Loads (or initialises) their session from Redis
//   3. Parses the cumulative input string to determine current navigation depth
//   4. Routes to the appropriate handler (balance, statement, loan, repay)
//   5. Returns a CON or END response string to the caller
//
// Africa's Talking sends these fields in every webhook POST:
//   sessionId    - Unique session identifier (reused across multi-step flows)
//   serviceCode  - The dialled shortcode (*234#)
//   phoneNumber  - Caller's MSISDN (+256700123456)
//   text         - Cumulative input, steps separated by * (e.g. "4*500000*2")
//   networkCode  - Carrier code (optional)
// =============================================================================

'use strict';

const sessionStore = require('../services/session.service');
const backend      = require('../services/backend.service');
const { MENUS }    = require('../utils/response.builder');
const logger       = require('../config/logger');

const { handleBalance }          = require('./balance.handler');
const { handleMiniStatement }    = require('./statement.handler');
const { handleLoanStatus }       = require('./loanstatus.handler');
const { startLoanApplication,
        handleLoanApplication }  = require('./loanapply.handler');
const { startRepayment,
        handleRepayment }        = require('./repayment.handler');

/**
 * Parse the cumulative text input from Africa's Talking.
 * "4*500000*2*Business capital" → ['4', '500000', '2', 'Business capital']
 * "" or undefined               → []
 */
function parseInputs(text) {
  if (!text || text.trim() === '') return [];
  return text.split('*').map(s => s.trim());
}

/**
 * Master USSD request handler.
 * Called by the Express route on every incoming webhook.
 */
async function routeUssdRequest({ sessionId, phoneNumber, text }) {
  const inputs = parseInputs(text);
  const depth  = inputs.length;        // 0 = first dial, 1 = main menu choice, 2+ = sub-flow

  logger.info(`USSD route: session=${sessionId} phone=${phoneNumber} depth=${depth} text="${text}"`);

  // ── Load existing session ──────────────────────────────────────────────────
  let sess = await sessionStore.getSession(sessionId);

  // ── First dial (depth 0): Show main menu ──────────────────────────────────
  if (depth === 0) {
    // Resolve member identity on every fresh dial
    const member = await resolveMember(phoneNumber, sessionId);
    if (!member) return MENUS.ERROR_NOT_REGISTERED;
    return MENUS.MAIN;
  }

  // ── Ensure member is resolved in session ──────────────────────────────────
  if (!sess || !sess.memberId) {
    const member = await resolveMember(phoneNumber, sessionId);
    if (!member) return MENUS.ERROR_NOT_REGISTERED;
    sess = await sessionStore.getSession(sessionId);
  }

  const lastInput = inputs[depth - 1];

  // ── Active multi-step flow: delegate to the correct handler ───────────────
  if (sess && sess.flow) {
    logger.debug(`Continuing flow: ${sess.flow} / step: ${sess.step} / input: ${lastInput}`);

    switch (sess.flow) {
      case 'LOAN_APPLY':
        return handleLoanApplication(sessionId, sess, lastInput, phoneNumber);
      case 'REPAYMENT':
        return handleRepayment(sessionId, sess, lastInput, phoneNumber);
      default:
        await sessionStore.deleteSession(sessionId);
        return MENUS.MAIN;
    }
  }

  // ── Depth 1: Main menu choice ─────────────────────────────────────────────
  if (depth === 1) {
    const choice = inputs[0];

    switch (choice) {
      case '1': return handleBalance(sess, phoneNumber);
      case '2': return handleMiniStatement(sess);
      case '3': return handleLoanStatus(sess);
      case '4': return startLoanApplication(sessionId, sess);
      case '5': return startRepayment(sessionId, sess);
      case '0': return MENUS.EXIT;
      default:  return MENUS.INVALID_OPTION;
    }
  }

  // ── Depth 2+ with no active flow: user navigated back — show main menu ────
  return MENUS.MAIN;
}

/**
 * Resolve member identity from phone number.
 * Writes memberId into the session so subsequent steps don't need to look it up.
 */
async function resolveMember(phone, sessionId) {
  try {
    const member = await backend.getMemberByPhone(phone);
    if (!member) {
      logger.warn(`Unregistered phone: ${phone}`);
      return null;
    }
    await sessionStore.setSession(sessionId, {
      phone,
      memberId: member.memberId,
      fullName: member.fullName,
    });
    logger.debug(`Member resolved: ${phone} → ${member.memberId}`);
    return member;
  } catch (err) {
    logger.error(`Member resolution failed for ${phone}: ${err.message}`);
    return null;
  }
}

module.exports = { routeUssdRequest };
