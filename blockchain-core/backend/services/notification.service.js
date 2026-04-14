// =============================================================================
// In-app notifications (Prisma) — create records without failing parent requests
// =============================================================================

'use strict';

const config = require('../config');
const prisma = require('./db.service');
const logger = require('../config/logger');
const africastalking = require('./africastalking.service');

/** @param {string} type Prisma NotificationType enum value */
async function createInAppNotification(memberId, type, title, message) {
  try {
    await prisma.notification.create({
      data: {
        memberId,
        type,
        title,
        message,
        channel: 'IN_APP',
      },
    });
  } catch (err) {
    logger.warn(`Notification create failed: ${err.message}`);
  }
}

/**
 * SMS the member after a teller deposit/withdraw (Africa's Talking).
 * Best-effort only — does not throw; ledger write already succeeded.
 */
async function notifySavingsBySms(memberId, message) {
  if (!config.africasTalking.smsSavingsAlerts || !africastalking.isConfigured()) return;
  const text = String(message || '').trim();
  if (!text) return;
  try {
    const user = await prisma.user.findUnique({
      where:  { memberId },
      select: { phone: true },
    });
    const phone = user?.phone?.trim();
    if (!phone) return;
    await africastalking.sendSms(phone, text.slice(0, 480));
  } catch (err) {
    logger.warn(`Savings SMS (${memberId}): ${err.message}`);
  }
}

module.exports = { createInAppNotification, notifySavingsBySms };
