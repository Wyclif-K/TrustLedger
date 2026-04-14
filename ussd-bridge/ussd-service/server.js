// =============================================================================
// TrustLedger USSD Service - Server Entry Point
// =============================================================================

'use strict';

const app          = require('./app');
const config       = require('./config');
const logger       = require('./config/logger');
const sessionStore = require('./services/session.service');
const smsService   = require('./services/sms.service');

let server;

async function start() {
  try {
    // ── 1. Connect to Redis (session store) ─────────────────────────────────
    if (config.redis.enabled) {
      logger.info('Connecting to Redis...');
    }
    await sessionStore.connect();

    // ── 2. Initialise Africa's Talking SMS ──────────────────────────────────
    smsService.init();

    // ── 3. Start HTTP server ─────────────────────────────────────────────────
    server = app.listen(config.port, () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║       TrustLedger USSD Bridge Service                ║
║                                                      ║
║  Status:    Running                                  ║
║  Port:      ${String(config.port).padEnd(42)}║
║  Env:       ${String(config.env).padEnd(42)}║
║  Shortcode: ${String(config.africastalking.shortcode).padEnd(42)}║
║  Session TTL: ${String(config.redis.sessionTtl + 's').padEnd(40)}║
╚══════════════════════════════════════════════════════╝
      `);
      logger.info(`USSD webhook endpoint: POST http://0.0.0.0:${config.port}/ussd`);
      logger.info(`Health check:          GET  http://0.0.0.0:${config.port}/health`);
    });

  } catch (err) {
    logger.error('Failed to start USSD service:', err);
    await shutdown(1);
  }
}

async function shutdown(code = 0) {
  logger.info('Shutting down USSD service...');
  try {
    if (server) server.close();
    await sessionStore.disconnect();
    logger.info('Shutdown complete.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(code);
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT',  () => shutdown(0));
process.on('uncaughtException',  (err) => { logger.error('Uncaught Exception:', err);  shutdown(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled Rejection:', err); shutdown(1); });

start();
