#!/usr/bin/env node
// =============================================================================
// TrustLedger USSD Bridge — preflight checks before going live or simulating.
// Run: npm run check-setup
// =============================================================================

'use strict';

const axios = require('axios');
const config = require('./config');

const RED = '\x1b[31m';
const GRN = '\x1b[32m';
const YLW = '\x1b[33m';
const RST = '\x1b[0m';

let failures = 0;
let warnings = 0;

function fail(msg) {
  console.log(`${RED}✗${RST} ${msg}`);
  failures += 1;
}

function warn(msg) {
  console.log(`${YLW}!${RST} ${msg}`);
  warnings += 1;
}

function ok(msg) {
  console.log(`${GRN}✓${RST} ${msg}`);
}

async function main() {
  console.log('\nTrustLedger USSD setup check\n');

  // ── Local config ───────────────────────────────────────────────────────────
  if (!config.backend.apiKey) {
    fail('BACKEND_API_KEY is empty — copy ussd-bridge/ussd-service/.env.example to .env and set the same value as USSD_SERVICE_KEY in blockchain-core/backend/.env');
  } else {
    ok(`BACKEND_API_KEY is set (${config.backend.apiKey.length} chars)`);
  }

  ok(`BACKEND_API_URL → ${config.backend.apiUrl}`);

  if (!config.africastalking.apiKey) {
    warn('AT_API_KEY is empty — SMS confirmations disabled (USSD menus still work)');
  } else {
    ok(`Africa's Talking configured (${config.africastalking.username})`);
  }

  ok(`Shortcode reference: ${config.africastalking.shortcode}`);

  // ── Bridge health ──────────────────────────────────────────────────────────
  const bridgeUrl = `http://127.0.0.1:${config.port}/health`;
  try {
    const r = await axios.get(bridgeUrl, { timeout: 5000 });
    ok(`USSD bridge responding on port ${config.port}`);
    const redis = r.data?.redis;
    if (redis?.status === 'memory' || redis?.connected === false) {
      warn('Redis not connected — multi-step flows use in-memory sessions (fine for dev; use Redis in production)');
    } else if (redis?.status === 'redis' && redis?.connected) {
      ok('Redis session store connected');
    }
  } catch (err) {
    fail(`USSD bridge not running on port ${config.port} — start with: npm run dev`);
  }

  // ── Backend API + service key ──────────────────────────────────────────────
  try {
    const health = await axios.get(`${config.backend.apiUrl}/health`, { timeout: 8000 });
    const h = health.data;
    if (h.database === 'up') ok('Backend PostgreSQL is up');
    else fail('Backend PostgreSQL is down — start Postgres and run prisma migrate deploy');

    if (h.fabric === 'disabled') {
      warn('Fabric is disabled — balance and loan menus will fail until FABRIC_ENABLED=true');
    } else if (h.fabric === 'up') ok('Hyperledger Fabric peer reachable');
    else warn(`Fabric not connected (${h.fabricDetail || 'check peer endpoint'})`);

    if (h.ussdInternalApi !== 'configured') {
      fail('Backend USSD_SERVICE_KEY is not set — internal /internal/ussd/* routes return 503');
    } else {
      ok('Backend USSD_SERVICE_KEY configured');
    }
  } catch (err) {
    fail(`Cannot reach backend at ${config.backend.apiUrl} — start blockchain-core/backend (npm run dev)`);
  }

  // ── Service key handshake ──────────────────────────────────────────────────
  if (config.backend.apiKey) {
    try {
      // 404 = key accepted, member not found — that's OK for this probe
      const probe = await axios.get(`${config.backend.apiUrl}/internal/ussd/members/by-phone`, {
        params:  { phone: '+256700123456' },
        headers: { 'X-Service-Key': config.backend.apiKey },
        timeout: 8000,
        validateStatus: () => true,
      }).catch((e) => e.response);

      if (!probe) {
        fail('Internal USSD API probe failed (no response)');
      } else if (probe.status === 403) {
        fail('BACKEND_API_KEY does not match backend USSD_SERVICE_KEY (403 Forbidden)');
      } else if (probe.status === 503) {
        fail('Backend USSD internal API not configured (503)');
      } else if (probe.status === 404 || probe.status === 200) {
        ok('Service key accepted by backend internal USSD API');
        if (probe.status === 404) {
          warn('No member with phone +256700123456 — register a member with that phone (or your test SIM) in the admin dashboard');
        }
      } else {
        warn(`Unexpected probe status ${probe.status}: ${probe.data?.message || ''}`);
      }
    } catch (err) {
      fail(`Service key probe error: ${err.message}`);
    }
  }

  // ── Sample USSD request ────────────────────────────────────────────────────
  try {
    const r = await axios.post(
      `http://127.0.0.1:${config.port}/ussd`,
      new URLSearchParams({
        sessionId:   'setup-check-001',
        serviceCode: config.africastalking.shortcode,
        phoneNumber: '+256700123456',
        text:        '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 },
    );
    const body = String(r.data || '');
    if (body.startsWith('CON ') && body.includes('TrustLedger')) {
      ok('USSD main menu returned for test phone');
    } else if (body.includes('not registered') || body.includes('not\nregistered')) {
      warn('USSD responded but phone +256700123456 is not registered — add member in admin with matching phone');
    } else {
      warn(`Unexpected USSD response: ${body.slice(0, 80)}`);
    }
  } catch (err) {
    if (err.code !== 'ECONNREFUSED') {
      warn(`USSD menu probe: ${err.message}`);
    }
  }

  console.log('');
  if (failures === 0) {
    console.log(`${GRN}Ready to test.${RST} Run: npm run simulate`);
    console.log('For real handsets: point Africa\'s Talking callback to your public URL + /ussd');
    console.log('  Embedded on Railway: https://YOUR-APP.up.railway.app/ussd-bridge/ussd');
    console.log('  Standalone bridge:   https://YOUR-USSD-HOST/ussd\n');
  } else {
    console.log(`${RED}${failures} blocking issue(s)${RST}, ${warnings} warning(s). Fix failures above.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
