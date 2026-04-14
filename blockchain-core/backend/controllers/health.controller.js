// =============================================================================
// TrustLedger - Health (database + optional Fabric connectivity)
// =============================================================================

'use strict';

const prisma = require('../services/db.service');
const config = require('../config');
const fabricService = require('../services/fabric.service');

/**
 * GET /api/v1/health
 * Public. Used by the admin UI status pill and load balancers.
 */
async function health(req, res) {
  const at = config.africasTalking;
  const body = {
    success:   true,
    service:   'TrustLedger API',
    timestamp: new Date().toISOString(),
    env:       config.env,
    database:  'unknown',
    fabric:    config.fabric.enabled ? 'unknown' : 'disabled',
    /** Env present for SMS / dashboard; does not call Africa's Talking on each health request */
    africasTalking: at.configured ? 'configured' : 'not_configured',
    /** USSD bridge can call internal routes when USSD_SERVICE_KEY is set (no secret exposed here). */
    ussdInternalApi: config.ussdService.key ? 'configured' : 'not_configured',
    /** Safe channel metadata for the admin dashboard (no API keys). */
    channels: {
      africaSTalking: {
        configured:  at.configured,
        username:      at.username || null,
        shortCode:     at.shortCode || null,
        smsFrom:       at.smsFrom || null,
        environment:   String(at.apiBaseUrl || '').includes('sandbox') ? 'sandbox' : 'production',
      },
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    body.database = 'up';
  } catch {
    body.database = 'down';
    body.success = false;
  }

  if (config.fabric.enabled) {
    body.fabric = fabricService.isConnected() ? 'up' : 'down';
  }

  const httpStatus = body.database === 'up' ? 200 : 503;
  if (httpStatus === 503) {
    return res.status(503).json({
      ...body,
      message:
        'PostgreSQL is down or unreachable on the machine running this API. ' +
        'Start Postgres, fix DATABASE_URL in .env, then restart the Node server. ' +
        'Login and the admin dashboard need the database.',
    });
  }
  res.status(200).json(body);
}

module.exports = { health };
