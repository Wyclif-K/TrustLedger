// =============================================================================
// Internal HTTP API for the USSD bridge microservice (X-Service-Key only).
// =============================================================================

'use strict';

const { query, param } = require('express-validator');
const prisma = require('../services/db.service');
const fabricService = require('../services/fabric.service');
const { sendSuccess, sendError } = require('../utils/response');

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

async function getMemberByPhone(req, res, next) {
  try {
    const phone = req.query.phone;
    const variants = phoneLookupVariants(phone);
    if (variants.length === 0) return sendError(res, 400, 'phone query parameter required.');

    const user = await prisma.user.findFirst({
      where:  { phone: { in: variants } },
      select: { memberId: true, fullName: true, phone: true, status: true },
    });
    if (!user) return sendError(res, 404, 'No member registered for this phone number.');
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
