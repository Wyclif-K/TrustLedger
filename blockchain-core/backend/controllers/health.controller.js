// =============================================================================
// TrustLedger - Health (database + optional Fabric connectivity)
// =============================================================================

'use strict';

const prisma = require('../services/db.service');
const config = require('../config');
const fabricService = require('../services/fabric.service');

/**
 * GET /api/v1/health/ussd-bridge
 * Public. Server-side probe of the USSD microservice so the admin UI does not rely on
 * a reverse-proxy path like /ussd-bridge (which returns SPA HTML in production).
 */
async function ussdBridgeHealth(req, res) {
  const base = config.ussdBridge.publicBaseUrl;
  if (!base) {
    return res.status(200).json({
      success:      false,
      service:      'TrustLedger USSD Bridge',
      configured:   false,
      reachable:    false,
      redis:        { status: 'unknown' },
      backend:      'not_configured',
      message:
        'Set USSD_BRIDGE_PUBLIC_URL on this API to the bridge base URL (e.g. https://your-ussd-service.up.railway.app), ' +
        'then redeploy. Without it the dashboard cannot reach GET /health on the bridge.',
    });
  }

  const url = `${base.replace(/\/$/, '')}/health`;
  try {
    const controller = new AbortController();
    const timeoutMs = 8000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(url, {
      signal:  controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);

    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const snippet = text.trim().replace(/\s+/g, ' ').slice(0, 100);
      return res.status(200).json({
        success:     false,
        service:     'TrustLedger USSD Bridge',
        configured:  true,
        reachable:   false,
        redis:       { status: 'unknown' },
        backend:
          'error: bridge returned HTML or non-JSON — check USSD_BRIDGE_PUBLIC_URL points at the ussd-service ' +
          `(got: "${snippet}${text.length > 100 ? '…' : ''}")`,
      });
    }

    if (!r.ok) {
      return res.status(200).json({
        ...json,
        reachable:   false,
        httpStatus:  r.status,
        backend:
          typeof json.backend === 'string'
            ? json.backend
            : `HTTP ${r.status} from bridge`,
      });
    }

    return res.status(200).json(json);
  } catch (e) {
    const msg =
      e && e.name === 'AbortError'
        ? `timeout after 8s (${url})`
        : (e && e.message) || String(e);
    return res.status(200).json({
      success:     false,
      service:     'TrustLedger USSD Bridge',
      configured:  true,
      reachable:   false,
      redis:       { status: 'unknown' },
      backend:     `error: ${msg}`,
    });
  }
}

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

module.exports = { health, ussdBridgeHealth };
