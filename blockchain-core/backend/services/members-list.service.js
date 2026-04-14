// =============================================================================
// Merge Hyperledger Fabric member records with PostgreSQL MEMBER users so the
// admin UI reflects everyone registered in auth, even when the ledger is empty
// or temporarily unavailable.
// =============================================================================

'use strict';

const config = require('../config');
const logger = require('../config/logger');
const prisma = require('./db.service');
const fabricService = require('./fabric.service');

/**
 * Load ledger members when Fabric is enabled; swallow errors and return [].
 */
async function fetchLedgerMembers() {
  if (!config.fabric.enabled) return [];
  try {
    const raw = await fabricService.SavingsContract.evaluate('getAllMembers');
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    logger.warn(`Fabric getAllMembers unavailable: ${err.message}`);
    return [];
  }
}

/**
 * All people to show on the Members screen: union of ledger + Prisma users
 * (every role except SUPER_ADMIN). Ledger row wins when the same memberId exists on both.
 * SUPER_ADMIN is excluded so the bootstrap account does not appear as a SACCO member row.
 */
async function getMergedMembers() {
  const [ledgerMembers, prismaMembers] = await Promise.all([
    fetchLedgerMembers(),
    prisma.user.findMany({
      where: { NOT: { role: 'SUPER_ADMIN' } },
      select: {
        memberId: true,
        fullName: true,
        phone: true,
        nationalId: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const byId = new Map();

  for (const m of ledgerMembers) {
    if (m && m.memberId) {
      byId.set(m.memberId, { ...m, ledgerSynced: true });
    }
  }

  for (const u of prismaMembers) {
    if (byId.has(u.memberId)) continue;
    const chainRole = String(u.role || 'MEMBER').toLowerCase();
    byId.set(u.memberId, {
      docType: 'member',
      memberId: u.memberId,
      fullName: u.fullName,
      phone: u.phone,
      nationalId: u.nationalId,
      email: u.email,
      role: chainRole,
      status: u.status,
      registeredBy: null,
      registeredAt: u.createdAt ? u.createdAt.toISOString() : null,
      updatedAt: u.updatedAt ? u.updatedAt.toISOString() : null,
      ledgerSynced: false,
    });
  }

  const list = Array.from(byId.values());
  list.sort((a, b) =>
    String(b.registeredAt || '').localeCompare(String(a.registeredAt || ''))
  );
  return list;
}

function memberCountsFromList(list) {
  return {
    total: list.length,
    active: list.filter((m) => m.status === 'ACTIVE').length,
    suspended: list.filter((m) => m.status === 'SUSPENDED').length,
  };
}

module.exports = {
  getMergedMembers,
  memberCountsFromList,
};
