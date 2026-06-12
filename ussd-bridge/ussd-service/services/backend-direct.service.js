// =============================================================================
// In-process backend for embedded USSD (same Node container as the API).
// Avoids HTTP loopback + X-Service-Key; Africa's Talking never uses Bearer JWT.
// Requires this file to live at backend/ussd-service/services/ (Docker COPY layout).
// =============================================================================

'use strict';

const { findMemberByPhone } = require('../../services/member-phone.service');
const fabricService = require('../../services/fabric.service');
const prisma = require('../../services/db.service');
const {
  createSavingsDepositRequest,
  createLoanRepaymentRequest,
} = require('../../controllers/member-requests.controller');
const { createInAppNotification } = require('../../services/notification.service');

async function getMemberByPhone(phone) {
  const user = await findMemberByPhone(phone);
  if (!user) return null;
  if (user.status !== 'ACTIVE') {
    const err = new Error('Your account is not active. Visit the branch.');
    err.code = 'INACTIVE';
    throw err;
  }
  return {
    memberId: user.memberId,
    fullName: user.fullName,
    phone:    user.phone,
    status:   user.status,
  };
}

async function getUssdBalance(memberId) {
  const data = await fabricService.LedgerContract.evaluate('getUssdBalance', memberId);
  return {
    memberId:    data.memberId,
    balance:     Number(data.balance) || 0,
    loanBalance: Number(data.loanBalance) || 0,
    nextDueDate: data.nextDueDate || null,
    ussdText:    data.ussdText,
  };
}

async function getMiniStatement(memberId) {
  const data = await fabricService.LedgerContract.evaluate('getUssdMiniStatement', memberId);
  return {
    memberId:     data.memberId,
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    ussdText:     data.ussdText,
  };
}

async function getBalance(memberId) {
  const data = await fabricService.SavingsContract.evaluate('getBalance', memberId);
  return data;
}

async function getMemberLoans(memberId) {
  return fabricService.LoansContract.evaluate('getMemberLoans', memberId);
}

async function getActiveLoan(memberId) {
  const loans = await getMemberLoans(memberId);
  return (loans || []).find((l) => ['PENDING', 'APPROVED', 'DISBURSED'].includes(l.status)) || null;
}

async function getDisbursedLoan(memberId) {
  const loans = await getMemberLoans(memberId);
  return (loans || []).find((l) => l.status === 'DISBURSED') || null;
}

async function applyForLoan(memberId, amount, termMonths, purpose) {
  const result = await fabricService.LoansContract.submit(
    'applyForLoan',
    memberId,
    String(amount),
    String(termMonths),
    purpose,
  );
  await createInAppNotification(
    memberId,
    'GENERAL',
    'Loan Application Submitted',
    `Your loan application for UGX ${Number(amount).toLocaleString()} has been submitted. An administrator will review it before it is recorded on the blockchain.`,
  );
  return result;
}

async function submitRepaymentRequest(memberId, loanId, amount, reference) {
  const result = await createLoanRepaymentRequest(memberId, loanId, amount, 'USSD', reference);
  if (!result.ok) {
    const err = new Error(result.message || 'Repayment request failed');
    err.status = result.status;
    throw err;
  }
  return result.data;
}

async function submitSavingsRequest(memberId, amount, reference) {
  const result = await createSavingsDepositRequest(memberId, amount, 'USSD', reference);
  if (!result.ok) {
    const err = new Error(result.message || 'Savings request failed');
    err.status = result.status;
    throw err;
  }
  return result.data;
}

async function getLoanPolicy() {
  return fabricService.LoansContract.evaluate('getLoanPolicy');
}

async function checkBackendHealth() {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true, data: { database: 'up' } };
}

module.exports = {
  getMemberByPhone,
  getUssdBalance,
  getMiniStatement,
  getBalance,
  getActiveLoan,
  getDisbursedLoan,
  applyForLoan,
  submitRepaymentRequest,
  submitSavingsRequest,
  getLoanPolicy,
  checkBackendHealth,
};
