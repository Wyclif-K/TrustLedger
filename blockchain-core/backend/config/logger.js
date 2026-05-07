// =============================================================================
// TrustLedger - Winston Logger
// =============================================================================

'use strict';

const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('./index');

/** Container hosts (Railway, etc.) should log stdout only unless ENABLE_ROTATE_FILE_LOG=true — avoids mkdir / disk issues. */
const envRotate = process.env.ENABLE_ROTATE_FILE_LOG;
const enableRotate =
  envRotate != null && String(envRotate).trim() !== ''
    ? String(envRotate).toLowerCase() === 'true'
    : !config.isProd;

let logDir = '';
if (enableRotate) {
  logDir = path.resolve(config.logging.dir);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const base = `${timestamp} [${level.toUpperCase()}] ${message}`;
    return stack ? `${base}\n${stack}` : base;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), format),
  }),
];
if (enableRotate && logDir) {
  transports.push(
    new DailyRotateFile({
      dirname:  logDir,
      filename: 'trustledger-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
    })
  );
}

const logger = winston.createLogger({
  level:      config.logging.level,
  format,
  transports,
});

module.exports = logger;
