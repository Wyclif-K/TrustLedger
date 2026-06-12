// =============================================================================
// Resolve SACCO members by phone (USSD + internal API)
// =============================================================================

'use strict';

const prisma = require('./db.service');
const { digitsOnly, normalizePhoneE164, phoneLookupVariants } = require('../utils/phone');

async function findMemberByPhone(rawPhone) {
  const variants = phoneLookupVariants(rawPhone);
  const normalized = normalizePhoneE164(rawPhone);
  if (normalized) variants.push(normalized);

  const unique = [...new Set(variants.filter(Boolean))];
  if (unique.length === 0) return null;

  const select = { memberId: true, fullName: true, phone: true, status: true, role: true };

  let user = await prisma.user.findFirst({
    where: {
      role:   'MEMBER',
      phone:  { in: unique },
    },
    select,
  });
  if (user) return user;

  const d = digitsOnly(rawPhone);
  const national = d.length >= 9 ? d.slice(-9) : null;
  if (national) {
    user = await prisma.user.findFirst({
      where: {
        role:  'MEMBER',
        phone: { endsWith: national },
      },
      select,
    });
  }

  return user;
}

module.exports = { findMemberByPhone, normalizePhoneE164, phoneLookupVariants };
