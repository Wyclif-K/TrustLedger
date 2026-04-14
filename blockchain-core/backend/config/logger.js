// =============================================================================
// TrustLedger - Winston Logger
// =============================================================================

'use strict';

const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('./index');

const logDir = path.resolve(config.logging.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const base = `${timestamp} [${level.toUpperCase()}] ${message}`;
    return stack ? `${base}\n${stack}` : base;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), format),
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'trustledger-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
  ],
});

module.exports = logger;
