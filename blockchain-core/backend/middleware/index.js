// =============================================================================
// TrustLedger - Global middleware (errors, validation, audit)
// =============================================================================

'use strict';

const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');
const prisma = require('../services/db.service');
const logger = require('../config/logger');

/**
 * Prisma / Postgres errors often mention ECONNREFUSED or "Connection refused".
 * Those must not be classified as Fabric peer errors (login would wrongly return 503 + Fabric text).
 */
function isDatabaseUnavailableError(err) {
  const name = err?.name || '';
  if (name === 'PrismaClientInitializationError') return true;
  if (name === 'PrismaClientRustPanicError') return true;
  if (name === 'PrismaClientKnownRequestError') {
    if (['P1001', 'P1002', 'P1013', 'P1017'].includes(err.code)) return true;
  }
  const m = String(err.message || '');
  if (/Can't reach database server|database server.*not running|Server has closed the connection/i.test(m)) {
    return true;
  }
  if (/prisma/i.test(name) && /connect|ECONNREFUSED|Connection refused|timeout|ETIMEDOUT/i.test(m)) {
    return true;
  }
  if (/PrismaClient/i.test(name) && /ECONNREFUSED|Connection refused|connect/i.test(m)) return true;
  // Node/pg TCP errors often lack "Prisma" in err.name but mention Postgres port or service
  if (
    /ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection refused|connect ETIMEDOUT/i.test(m) &&
    /\b5432\b|postgresql|postgres/i.test(m)
  ) {
    return true;
  }
  if (/P1001|P1002|P1013|P1017/.test(m)) return true;
  return false;
}

/**
 * Fabric/gRPC peer issues — must NOT treat Postgres ECONNREFUSED (:5432) as Fabric.
 * Login only touches PostgreSQL; misclassification made mobile login show "Fabric peer" 503.
 */
function isFabricPeerDown(err) {
  if (isDatabaseUnavailableError(err)) return false;
  const m = String(err.message || '');
  if (/UNAVAILABLE|DEADLINE_EXCEEDED/i.test(m)) return true;
  if (/No connection established|dns\s*error|Name resolution failed/i.test(m)) return true;
  if (
    /ECONNREFUSED|Connection refused/i.test(m) &&
    /\b7051\b|\b7050\b|peer0|grpc|\.sock|fabric|chaincode|endorser/i.test(m)
  ) {
    return true;
  }
  return false;
}

/**
 * Fabric endorser rejects the client identity (Validate/Verify), but returns a generic message.
 * Almost always: channel on disk was created with different crypto than FABRIC_CERT_PATH (regen + volumes).
 */
function isFabricChannelCreatorAccessDenied(err) {
  const m = String(err.message || '');
  return /access denied:\s*channel\s*\[[^\]]+\]\s*creator org\s*\[/i.test(m);
}

const FABRIC_MSP_CHANNEL_MISMATCH_HINT =
  'Fabric rejected the proposal (peer could not validate the client identity or signature). ' +
  'Restart the API after a signer/config fix. If you still see this, from blockchain-core/backend run npm run fabric:reset, then restart the API.';

/**
 * Per-peer chaincode errors from @hyperledger/fabric-gateway (GatewayError.details).
 * When grpc-status-details-bin is missing, the same text may appear on err.cause.details (gRPC string).
 */
function fabricPeerMessages(err) {
  if (Array.isArray(err.details) && err.details.length > 0) {
    const msgs = err.details.map((d) => d && d.message).filter(Boolean);
    if (msgs.length) return msgs.join(' ');
  }
  const cause = err.cause;
  if (cause && typeof cause.details === 'string' && cause.details.trim()) {
    return cause.details.trim();
  }
  return null;
}

/** gRPC often returns this when rich error details are not attached; replace with a useful hint. */
const GENERIC_ENDORSE_MSG = /^\d+\s+ABORTED:\s*failed to endorse transaction,?\s*see attached details/i;

function isGenericFabricEndorseFailure(err) {
  return err.name === 'EndorseError' || GENERIC_ENDORSE_MSG.test(String(err.message || ''));
}

const ENDORSE_FAILURE_HINT =
  'Chaincode endorsement failed. If this Member ID was already registered on the ledger, choose a new ID. ' +
  'Otherwise confirm the network is up (npm run fabric:up), chaincode is deployed (npm run fabric:deploy), ' +
  'and the backend uses the Admin@sacco.trustledger.com Fabric identity.';

function errorHandler(err, req, res, next) {
  const peerFabricMsg = fabricPeerMessages(err);
  logger.error(`${req.method} ${req.originalUrl} → ${err.message}`, {
    stack:       err.stack,
    user:        req.user?.sub,
    fabricPeers: peerFabricMsg || undefined,
  });

  if (isDatabaseUnavailableError(err)) {
    return sendError(
      res,
      503,
      'PostgreSQL is unreachable or DATABASE_URL is wrong. Fix the database on the machine that runs the API (login uses the database only, not Hyperledger Fabric).'
    );
  }

  if (isFabricPeerDown(err)) {
    return sendError(
      res,
      503,
      'Hyperledger Fabric peer is not reachable. Start the network (e.g. npm run fabric:up from the backend folder) and ensure port 7051 is listening.'
    );
  }

  if (isFabricChannelCreatorAccessDenied(err)) {
    return sendError(res, 503, FABRIC_MSP_CHANNEL_MISMATCH_HINT);
  }

  if (peerFabricMsg) {
    let status = 400;
    if (/already exists/i.test(peerFabricMsg)) status = 409;
    else if (/Access denied\. Required role/i.test(peerFabricMsg)) status = 403;
    return sendError(res, status, peerFabricMsg);
  }

  if (isGenericFabricEndorseFailure(err)) {
    const msg = String(err.message || '');
    const body = GENERIC_ENDORSE_MSG.test(msg) ? ENDORSE_FAILURE_HINT : msg;
    return sendError(res, 400, body);
  }

  const isFabricError = err.message?.includes('Error:') || err.details?.length > 0;

  if (isFabricError) {
    const match = err.message?.match(/Error:\s*(.+?)(?:\s*at\s|$)/s);
    const clean = match ? match[1].trim() : err.message;
    return sendError(res, 400, clean);
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return sendError(res, 409, 'A record with that value already exists.');
    }
    if (['P1001', 'P1002', 'P1013', 'P1017'].includes(err.code)) {
      return sendError(
        res,
        503,
        'PostgreSQL is unreachable or DATABASE_URL is wrong. Fix the database on the machine that runs the API.'
      );
    }
    return sendError(res, 400, 'Database error.');
  }

  const status = err.status || err.statusCode || 500;
  sendError(res, status, err.message || 'Internal server error.');
}

function notFoundHandler(req, res) {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

function auditLogger(req, res, next) {
  const skipMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (skipMethods.includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    originalJson(body);

    const baseData = {
      action:     `${req.method} ${req.route?.path || req.path}`,
      resource:   req.baseUrl + req.path,
      resourceId: req.params?.memberId || req.params?.loanId || null,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent']?.substring(0, 255),
      statusCode: res.statusCode,
      metadata:   {
        body:   req.body,
        params: req.params,
      },
    };

    const userId = req.user?.sub || null;

    function writeAudit(uid) {
      return prisma.auditLog.create({ data: { ...baseData, userId: uid } });
    }

    writeAudit(userId).catch((err) => {
      if (err.code === 'P2003' && userId) {
        return writeAudit(null).catch((e) => logger.error('Audit log write failed:', e.message));
      }
      logger.error('Audit log write failed:', err.message);
    });
  };

  next();
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}

module.exports = {
  errorHandler,
  notFoundHandler,
  validate,
  auditLogger,
  requestLogger,
};
