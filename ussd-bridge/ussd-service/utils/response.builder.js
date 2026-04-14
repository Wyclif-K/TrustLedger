// =============================================================================
// TrustLedger USSD Service - Response Builder
//
// Africa's Talking (and most USSD providers) expect plain-text responses:
//   CON <text>  → continue session (show menu, wait for input)
//   END <text>  → terminate session (final message to user)
//
// USSD displays are 182 characters max per screen on most networks.
// Each line should be ≤ 20-25 characters for wide handset support.
// =============================================================================

'use strict';

// ── Continue (keep session open) ──────────────────────────────────────────────
const con = (text) => `CON ${text.trim()}`;

// ── End (close session) ───────────────────────────────────────────────────────
const end = (text) => `END ${text.trim()}`;

// ── Standard menus ────────────────────────────────────────────────────────────
const MENUS = {
  MAIN: con(
    'TrustLedger SACCO\n' +
    '1. Check Balance\n' +
    '2. Mini Statement\n' +
    '3. Loan Status\n' +
    '4. Apply for Loan\n' +
    '5. Make Repayment\n' +
    '0. Exit'
  ),

  EXIT: end('Thank you for using TrustLedger SACCO. Goodbye!'),

  ERROR_GENERIC: end(
    'An error occurred.\nPlease try again or\nvisit your nearest branch.'
  ),

  ERROR_NOT_REGISTERED: end(
    'Your number is not\nregistered with us.\nVisit the branch to register.'
  ),

  ERROR_TIMEOUT: end(
    'Session timed out.\nDial *234# to start again.'
  ),

  INVALID_OPTION: con(
    'Invalid option.\nPlease try again:\n\n' +
    '1. Balance\n2. Statement\n3. Loan\n4. Apply\n5. Repay\n0. Exit'
  ),
};

// ── Format currency for USSD (strict 80 char line budget) ─────────────────────
function formatAmount(n) {
  const num = Number(n);
  if (isNaN(num)) return 'UGX 0';
  return `UGX ${num.toLocaleString('en-UG')}`;
}

// ── Format date to short form (DD/MM/YYYY) ────────────────────────────────────
function formatDate(iso) {
  if (!iso) return 'N/A';
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return 'N/A'; }
}

// ── Pre-built response builders ───────────────────────────────────────────────
const responses = {

  // Balance screen
  balance: (memberId, balance, loanBalance, nextDue) => {
    let text = `TrustLedger SACCO\n`;
    text += `A/C: ${memberId}\n`;
    text += `Savings: ${formatAmount(balance)}\n`;
    if (loanBalance > 0) {
      text += `Loan due: ${formatAmount(loanBalance)}\n`;
      text += `Next pmt: ${formatDate(nextDue)}`;
    } else {
      text += `No active loan`;
    }
    return end(text);
  },

  // Mini-statement screen
  miniStatement: (memberId, transactions) => {
    if (!transactions || transactions.length === 0) {
      return end(`${memberId}\nNo transactions found.`);
    }
    const lines = transactions.slice(0, 5).map(tx => {
      const sign   = tx.type === 'DEPOSIT' ? '+' : '-';
      const amt    = `${sign}${Math.round(tx.amount / 1000)}K`;
      const date   = tx.timestamp ? tx.timestamp.split('T')[0].slice(5) : '??'; // MM-DD
      const label  = tx.type === 'DEPOSIT' ? 'DEP' :
                     tx.type === 'WITHDRAWAL' ? 'WDR' :
                     tx.type === 'LOAN_REPAY' ? 'RPY' : 'LNS';
      return `${date} ${label} ${amt}`;
    });
    return end(`TrustLedger\n${memberId}\n${lines.join('\n')}`);
  },

  // Loan status screen
  loanStatus: (loan) => {
    let text = `Loan Status\n`;
    text += `Ref: ${loan.loanId.slice(-10)}\n`;
    text += `Amt: ${formatAmount(loan.amount)}\n`;
    text += `Status: ${loan.status}\n`;
    if (loan.status === 'DISBURSED') {
      text += `Bal: ${formatAmount(loan.outstandingBalance)}\n`;
      text += `Due: ${formatDate(loan.nextDueDate)}`;
    }
    return end(text);
  },

  // Loan application prompts
  loanAskAmount: () => con(
    'Enter loan amount\nin UGX:\n(Min: 100,000\nMax: 50,000,000)'
  ),

  loanAskTerm: () => con(
    'Choose repayment\nperiod:\n1. 3 months\n2. 6 months\n3. 12 months\n4. 24 months'
  ),

  loanAskPurpose: () => con(
    'Enter purpose:\n(e.g. School fees,\nBusiness capital)'
  ),

  loanConfirm: (amount, termMonths, monthlyInstalment, totalRepayable) =>
    con(
      `Confirm Loan:\n` +
      `Amt: ${formatAmount(amount)}\n` +
      `Term: ${termMonths} months\n` +
      `Monthly: ${formatAmount(monthlyInstalment)}\n` +
      `Total: ${formatAmount(totalRepayable)}\n\n` +
      `1. Confirm\n2. Cancel`
    ),

  loanSubmitted: (loanId) =>
    end(
      `Loan application\nsubmitted!\nRef: ${loanId.slice(-10)}\nAwaiting approval.`
    ),

  // Repayment prompts
  repayAskAmount: (outstanding, monthly) =>
    con(
      `Outstanding:\n${formatAmount(outstanding)}\nMonthly: ${formatAmount(monthly)}\n\nEnter amount\n(UGX):`
    ),

  repayConfirm: (amount, loanId, outstanding) =>
    con(
      `Confirm Payment:\nAmt: ${formatAmount(amount)}\nLoan: ${loanId.slice(-10)}\nBal after: ${formatAmount(outstanding - amount)}\n\n1. Confirm\n2. Cancel`
    ),

  repaySuccess: (amount, outstanding, ref) => {
    if (outstanding <= 0) {
      return end(`Payment confirmed!\nAmt: ${formatAmount(amount)}\nLoan FULLY REPAID!\nThank you.`);
    }
    return end(
      `Payment confirmed!\nAmt: ${formatAmount(amount)}\nRef: ${ref.slice(-12)}\nBal: ${formatAmount(outstanding)}`
    );
  },

  // Generic prompts
  askContinue: (message) => con(`${message}\n\n1. Main Menu\n0. Exit`),
};

module.exports = { con, end, MENUS, formatAmount, formatDate, responses };
