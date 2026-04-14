// =============================================================================
// TrustLedger - USSD Controller
// Handles Africa's Talking (and other providers) USSD webhook callbacks.
// This is System 2's entry point into the blockchain data.
//
// USSD Menu Structure:
//   *234# → Welcome
//     1. Check Balance
//     2. Mini Statement
//     3. Loan Status
//     4. Apply for Loan (initiates — admin completes)
//     5. Make Repayment
//     0. Exit
// =============================================================================

'use strict';

const fabricService = require('../services/fabric.service');
const prisma        = require('../services/db.service');
const logger        = require('../config/logger');

// Session store (in-memory — use Redis in production)
const sessions = new Map();

const MENU = {
  MAIN: `CON Welcome to TrustLedger SACCO\n1. Check Balance\n2. Mini Statement\n3. Loan Status\n4. Apply for Loan\n5. Make Repayment\n0. Exit`,
  EXIT: `END Thank you for using TrustLedger SACCO.`,
  ERR:  `END An error occurred. Please try again or visit the branch.`,
};

// ─── Main USSD Handler ────────────────────────────────────────────────────────
/**
 * POST /api/v1/ussd
 * Africa's Talking posts: sessionId, serviceCode, phoneNumber, text
 *
 * 'text' is cumulative: "1" on first input, "1*2" on second, etc.
 */
async function handleUssd(req, res) {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  logger.info(`USSD: session=${sessionId} phone=${phoneNumber} text="${text}"`);

  const inputs = text ? text.split('*') : [];
  const level  = inputs.length;

  let response = MENU.MAIN;

  try {
    // ── Level 0: First dial (no input yet) ──────────────────────────────────
    if (!text || text === '') {
      response = MENU.MAIN;

    // ── Level 1: Main menu choice ────────────────────────────────────────────
    } else if (level === 1) {
      const choice = inputs[0];

      switch (choice) {

        // 1. Check Balance
        case '1': {
          const memberId = await getMemberIdByPhone(phoneNumber);
          if (!memberId) {
            response = `END Your phone number is not registered. Visit the branch.`;
            break;
          }
          const data = await fabricService.LedgerContract.evaluate(
            'getUssdBalance', memberId
          );
          response = `END ${data.ussdText}`;
          break;
        }

        // 2. Mini Statement
        case '2': {
          const memberId = await getMemberIdByPhone(phoneNumber);
          if (!memberId) { response = `END Phone not registered.`; break; }
          const data = await fabricService.LedgerContract.evaluate(
            'getUssdMiniStatement', memberId
          );
          response = `END ${data.ussdText}`;
          break;
        }

        // 3. Loan Status
        case '3': {
          const memberId = await getMemberIdByPhone(phoneNumber);
          if (!memberId) { response = `END Phone not registered.`; break; }
          const loans = await fabricService.LoansContract.evaluate('getMemberLoans', memberId);
          const active = loans.find(l => ['PENDING','APPROVED','DISBURSED'].includes(l.status));
          if (!active) {
            response = `END No active loans.\nApply via option 4.`;
          } else {
            response = `END Loan: ${active.loanId}\nAmt: UGX ${active.amount.toLocaleString()}\nStatus: ${active.status}\nOutstanding: UGX ${active.outstandingBalance.toLocaleString()}\nNext due: ${active.nextDueDate?.split('T')[0] || 'N/A'}`;
          }
          break;
        }

        // 4. Apply for Loan - ask for amount
        case '4':
          sessions.set(sessionId, { flow: 'LOAN_APPLY', step: 'amount', phone: phoneNumber });
          response = `CON Enter loan amount (UGX):\n(Min: 100,000 Max: 50,000,000)`;
          break;

        // 5. Make Repayment - ask for amount
        case '5':
          sessions.set(sessionId, { flow: 'REPAYMENT', step: 'amount', phone: phoneNumber });
          response = `CON Enter repayment amount (UGX):`;
          break;

        // 0. Exit
        case '0':
          response = MENU.EXIT;
          break;

        default:
          response = `CON Invalid option.\n${MENU.MAIN.replace('CON ', '')}`;
      }

    // ── Level 2+: Multi-step flows ───────────────────────────────────────────
    } else {
      const session = sessions.get(sessionId);
      if (!session) {
        response = MENU.ERR;
      } else {
        response = await handleFlow(session, inputs, sessionId, phoneNumber);
      }
    }

  } catch (err) {
    logger.error('USSD handler error:', err.message);
    response = MENU.ERR;
  }

  // Africa's Talking expects plain text, not JSON
  res.set('Content-Type', 'text/plain');
  res.send(response);
}

// ─── Multi-Step Flow Handler ──────────────────────────────────────────────────
async function handleFlow(session, inputs, sessionId, phoneNumber) {
  const lastInput = inputs[inputs.length - 1];

  // ── Loan Application Flow ──────────────────────────────────────────────────
  if (session.flow === 'LOAN_APPLY') {
    if (session.step === 'amount') {
      const amount = parseInt(lastInput);
      if (isNaN(amount) || amount < 100000) {
        return `CON Invalid amount. Min UGX 100,000.\nEnter amount:`;
      }
      sessions.set(sessionId, { ...session, step: 'term', amount });
      return `CON Enter repayment period:\n1. 3 months\n2. 6 months\n3. 12 months\n4. 24 months`;
    }

    if (session.step === 'term') {
      const termMap = { '1': 3, '2': 6, '3': 12, '4': 24 };
      const termMonths = termMap[lastInput];
      if (!termMonths) return `CON Invalid option. Choose 1-4:`;

      sessions.set(sessionId, { ...session, step: 'purpose', termMonths });
      return `CON Enter loan purpose\n(e.g. School fees, Business):`;
    }

    if (session.step === 'purpose') {
      const { amount, termMonths } = session;
      const purpose = lastInput;

      sessions.set(sessionId, { ...session, step: 'confirm', purpose });
      return `CON Confirm Loan Application:\nAmount: UGX ${amount.toLocaleString()}\nTerm: ${termMonths} months\nPurpose: ${purpose}\n\n1. Confirm\n2. Cancel`;
    }

    if (session.step === 'confirm') {
      sessions.delete(sessionId);
      if (lastInput !== '1') return `END Loan application cancelled.`;

      const { amount, termMonths, purpose } = session;
      const memberId = await getMemberIdByPhone(phoneNumber);

      if (!memberId) return `END Phone not registered. Visit the branch.`;

      try {
        const result = await fabricService.LoansContract.submit(
          'applyForLoan', memberId, String(amount), String(termMonths), purpose
        );
        return `END Loan application submitted!\nRef: ${result.loanId}\nAwait admin approval.`;
      } catch (err) {
        logger.error('USSD loan apply failed:', err.message);
        return `END Failed: ${err.message.substring(0, 80)}`;
      }
    }
  }

  // ── Repayment Flow ─────────────────────────────────────────────────────────
  if (session.flow === 'REPAYMENT') {
    if (session.step === 'amount') {
      const amount = parseInt(lastInput);
      if (isNaN(amount) || amount < 1) return `CON Invalid amount.\nEnter amount:`;

      const memberId = await getMemberIdByPhone(phoneNumber);
      if (!memberId) return `END Phone not registered.`;

      const loans = await fabricService.LoansContract.evaluate('getMemberLoans', memberId);
      const activeLoan = loans.find(l => l.status === 'DISBURSED');
      if (!activeLoan) return `END No active disbursed loan found.`;

      sessions.set(sessionId, { ...session, step: 'confirm', amount, loanId: activeLoan.loanId });
      return `CON Confirm Repayment:\nLoan: ${activeLoan.loanId.slice(-8)}\nAmount: UGX ${amount.toLocaleString()}\nOutstanding: UGX ${activeLoan.outstandingBalance.toLocaleString()}\n\n1. Confirm\n2. Cancel`;
    }

    if (session.step === 'confirm') {
      sessions.delete(sessionId);
      if (lastInput !== '1') return `END Repayment cancelled.`;

      const { amount, loanId } = session;
      const ref = `USSD-${Date.now()}`;

      try {
        const result = await fabricService.LoansContract.submit(
          'repayLoan', loanId, String(amount), ref, 'USSD'
        );
        const msg = result.isFullyRepaid
          ? `Loan fully repaid! Congratulations.`
          : `Outstanding: UGX ${result.outstanding.toLocaleString()}`;
        return `END Repayment confirmed!\nRef: ${ref}\n${msg}`;
      } catch (err) {
        logger.error('USSD repay failed:', err.message);
        return `END Failed: ${err.message.substring(0, 80)}`;
      }
    }
  }

  return MENU.ERR;
}

// ─── Lookup Member ID by Phone ────────────────────────────────────────────────
/** Africa's Talking may send +256…, 256…, or local 07… — match how users were stored in PostgreSQL. */
function phoneLookupVariants(raw) {
  const s = raw == null ? '' : String(raw).trim().replace(/\s/g, '');
  if (!s) return [];
  const v = new Set();
  v.add(s);
  if (s.startsWith('+')) v.add(s.slice(1));
  else if (/^\d+$/.test(s)) v.add(`+${s}`);
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 9) {
    v.add(digits);
    v.add(`+${digits}`);
  }
  if (/^0\d{9,14}$/.test(digits)) {
    const intl = `256${digits.slice(1)}`;
    v.add(intl);
    v.add(`+${intl}`);
  }
  return [...v];
}

async function getMemberIdByPhone(phone) {
  const variants = phoneLookupVariants(phone);
  if (variants.length === 0) return null;
  try {
    const user = await prisma.user.findFirst({
      where:  { phone: { in: variants } },
      select: { memberId: true },
    });
    return user?.memberId || null;
  } catch {
    return null;
  }
}

module.exports = { handleUssd };
