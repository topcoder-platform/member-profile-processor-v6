/**
 * Winston logger configuration
 */

import winston from 'winston';
import config from '../config/default';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'member-profile-processor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Log full error with stack trace
 * @param error - Error object to log
 */
export function logFullError(error: Error | unknown): void {
  if (error instanceof Error) {
    logger.error('Full error details', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } else {
    logger.error('Unknown error', { error });
  }
}

interface ServiceWithLogger {
  logger?: typeof logger;
  logFullError?: typeof logFullError;
  [key: string]: unknown;
}

export function buildService(serviceModule: ServiceWithLogger): void {
  // Add common logging methods to service
  if (serviceModule && typeof serviceModule === 'object') {
    serviceModule.logger = logger;
    serviceModule.logFullError = logFullError;
  }
}

export default logger; 