// =============================================================================
// TrustLedger - Notifications (off-chain Prisma)
// =============================================================================

'use strict';

const { param, query } = require('express-validator');
const prisma = require('../services/db.service');
const { sendSuccess, sendError } = require('../utils/response');

function canViewGlobalNotifications(user) {
  return ['ADMIN', 'AUDITOR', 'SUPER_ADMIN'].includes(user?.role);
}

function buildScopeWhere(scope, user) {
  if (scope === 'all' && canViewGlobalNotifications(user)) {
    return {};
  }
  return { memberId: user.memberId };
}

/**
 * GET /api/v1/notifications/unread-count
 */
async function getUnreadCount(req, res, next) {
  try {
    const scope = String(req.query.scope || 'mine').toLowerCase();
    if (scope === 'all' && !canViewGlobalNotifications(req.user)) {
      return sendError(res, 403, 'Access denied. Global notification scope requires ADMIN/AUDITOR/SUPER_ADMIN.');
    }
    const scopeWhere = buildScopeWhere(scope, req.user);
    const count = await prisma.notification.count({
      where: {
        ...scopeWhere,
        isRead:     false,
      },
    });
    return sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/notifications?limit=20&unreadOnly=true
 */
async function list(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const scope = String(req.query.scope || 'mine').toLowerCase();
    if (scope === 'all' && !canViewGlobalNotifications(req.user)) {
      return sendError(res, 403, 'Access denied. Global notification scope requires ADMIN/AUDITOR/SUPER_ADMIN.');
    }
    const scopeWhere = buildScopeWhere(scope, req.user);
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true' || req.query.unreadOnly === '1';
    const where = {
      ...scopeWhere,
      ...(unreadOnly ? { isRead: false } : {}),
    };
    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  {
        id:        true,
        type:      true,
        title:     true,
        message:   true,
        channel:   true,
        isRead:    true,
        sentAt:    true,
        createdAt: true,
        memberId:  true,
      },
    });
    return sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 */
async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const scope = String(req.query.scope || 'mine').toLowerCase();

    if (scope === 'all' && !canViewGlobalNotifications(req.user)) {
      return sendError(
        res,
        403,
        'Access denied. Global notification scope requires ADMIN/AUDITOR/SUPER_ADMIN.'
      );
    }

    const scopeWhere = buildScopeWhere(scope, req.user);
    const result = await prisma.notification.updateMany({
      where: { ...scopeWhere, id },
      data:  { isRead: true },
    });
    if (result.count === 0) return sendError(res, 404, 'Notification not found.');
    return sendSuccess(res, { id, isRead: true });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 */
async function markAllRead(req, res, next) {
  try {
    const scope = String(req.query.scope || 'mine').toLowerCase();
    if (scope === 'all' && !canViewGlobalNotifications(req.user)) {
      return sendError(
        res,
        403,
        'Access denied. Global notification scope requires ADMIN/AUDITOR/SUPER_ADMIN.'
      );
    }

    const scopeWhere = buildScopeWhere(scope, req.user);
    const result = await prisma.notification.updateMany({
      where: { ...scopeWhere, isRead: false },
      data:  { isRead: true },
    });
    return sendSuccess(res, { updated: result.count });
  } catch (err) {
    next(err);
  }
}

const markReadValidators = [param('id').isUUID().withMessage('Invalid notification id.')];

const listValidators = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1–100.'),
  query('unreadOnly').optional().isIn(['true', 'false', '0', '1']).withMessage('unreadOnly must be true or false.'),
  query('scope').optional().isIn(['mine', 'all']).withMessage('scope must be mine or all.'),
];

module.exports = {
  getUnreadCount,
  list,
  listValidators,
  markRead,
  markReadValidators,
  markAllRead,
};
