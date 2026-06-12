// =============================================================================
// Internal HTTP API for the USSD bridge microservice (X-Service-Key only).
// =============================================================================

'use strict';

const { query, param } = require('express-validator');
const { findMemberByPhone } = require('../services/member-phone.service');
const fabricService = require('../services/fabric.service');
const { sendSuccess, sendError } = require('../utils/response');

async function getMemberByPhone(req, res, next) {
  try {
    const phone = req.query.phone;
    if (!phone || !String(phone).trim()) {
      return sendError(res, 400, 'phone query parameter required.');
    }

    const user = await findMemberByPhone(phone);
    if (!user) return sendError(res, 404, 'No member registered for this phone number.');
    if (user.status !== 'ACTIVE') {
      return sendError(res, 403, 'Your account is not active. Visit the branch.');
    }
    return sendSuccess(res, {
      memberId: user.memberId,
      fullName: user.fullName,
      phone:    user.phone,
      status:   user.status,
    });
  } catch (err) {
    next(err);
  }
}

async function getUssdBalance(req, res, next) {
  try {
    const { memberId } = req.params;
    const data = await fabricService.LedgerContract.evaluate('getUssdBalance', memberId);
    return sendSuccess(res, {
      memberId:     data.memberId,
      balance:      Number(data.balance) || 0,
      loanBalance:  Number(data.loanBalance) || 0,
      nextDueDate:  data.nextDueDate || null,
      ussdText:     data.ussdText,
    });
  } catch (err) {
    next(err);
  }
}

async function getUssdMiniStatement(req, res, next) {
  try {
    const { memberId } = req.params;
    const data = await fabricService.LedgerContract.evaluate('getUssdMiniStatement', memberId);
    return sendSuccess(res, {
      memberId:     data.memberId,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      ussdText:     data.ussdText,
    });
  } catch (err) {
    next(err);
  }
}

const byPhoneValidators = [
  query('phone').notEmpty().withMessage('phone is required.'),
];

const memberIdParam = [param('memberId').notEmpty()];

module.exports = {
  getMemberByPhone,
  getUssdBalance,
  getUssdMiniStatement,
  byPhoneValidators,
  memberIdParam,
};
