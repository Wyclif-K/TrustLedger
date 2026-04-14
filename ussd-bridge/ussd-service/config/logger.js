// =============================================================================
// TrustLedger USSD Service - Logger
// =============================================================================

'use strict';

const winston = require('winston');
const config  = require('./index');
const { combine, timestamp, printf, colorize, errors } = winston.format;

const fmt = printf(({ level, message, timestamp, stack, ...meta }) => {
  const base = `${timestamp} [USSD] [${level}] ${stack || message}`;
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return base + extra;
});

const logger = winston.createLogger({
  level: config.logging.level,
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        fmt
      ),
    }),
  ],
});

module.exports = logger;
