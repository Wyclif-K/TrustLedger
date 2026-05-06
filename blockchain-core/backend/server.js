// =============================================================================
// TrustLedger - Server Entry Point
// Starts the HTTP server and connects to Hyperledger Fabric on boot.
// =============================================================================

'use strict';

const app           = require('./app');
const config        = require('./config');
const logger        = require('./config/logger');
const fabricService = require('./services/fabric.service');
const prisma        = require('./services/db.service');
const atService     = require('./services/africastalking.service');

let server;

async function start() {
  try {
    // ── 1. Connect to PostgreSQL ─────────────────────────────────────────────
    logger.info('Connecting to PostgreSQL...');
    await prisma.$connect();
    logger.info('PostgreSQL connected.');

    // ── 2. Hyperledger Fabric (optional — see FABRIC_ENABLED in .env) ───────
    if (config.fabric.enabled) {
      logger.info('Connecting to Hyperledger Fabric...');
      await fabricService.connect();
      logger.info('Fabric network connected.');
      const ep = config.fabric.peerEndpoint || '';
      const host = ep.includes(':') ? ep.slice(0, ep.lastIndexOf(':')) : ep;
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(host);
      if (!isLocal) {
        logger.info(
          `Remote Fabric peer: ${ep} (TLS expects FABRIC_PEER_HOST_ALIAS=${config.fabric.peerHostAlias}). ` +
            'Open VPS/AWS security group inbound TCP for that port from your API host (e.g. Railway); gRPC uses TLS.'
        );
      }
    } else {
      logger.warn(
        'Hyperledger Fabric is disabled (FABRIC_ENABLED=false). PostgreSQL-backed auth works; blockchain routes return 503 until Fabric is enabled.'
      );
    }

    if (config.africasTalking.configured) {
      const at = await atService.validateCredentials();
      if (at.ok) {
        logger.info(`Africa's Talking: ${at.message}`);
      } else {
        logger.warn(`Africa's Talking credentials check failed: ${at.message}`);
      }
    } else {
      logger.info('Africa\'s Talking: AT_USERNAME / AT_API_KEY not set — SMS API disabled; USSD callback still works if the route is reachable.');
    }

    // ── 3. Start HTTP Server ─────────────────────────────────────────────────
    // Bind all interfaces so phones (hotspot / USB tether) can reach this PC by its tether IPv4.
    server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║           TrustLedger API Server                     ║
║                                                      ║
║  Status:  Running                                    ║
║  Port:    ${String(config.port).padEnd(42)}║
║  Env:     ${String(config.env).padEnd(42)}║
║  Prefix:  ${String(config.apiPrefix).padEnd(42)}║
╚══════════════════════════════════════════════════════╝
      `);
    });

  } catch (err) {
    logger.error('Failed to start server:', err);
    await shutdown(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(exitCode = 0) {
  logger.info('Shutting down TrustLedger API...');
  try {
    if (server) server.close();
    fabricService.disconnect();
    await prisma.$disconnect();
    logger.info('Shutdown complete.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(exitCode);
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT',  () => shutdown(0));
process.on('uncaughtException',  (err) => { logger.error('Uncaught Exception:', err);  shutdown(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled Rejection:', err); shutdown(1); });

start();
