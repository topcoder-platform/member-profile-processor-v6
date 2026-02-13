/**
 * Custom error classes for Member Profile Processor
 */

/**
 * Base application error class
 */
export abstract class BaseError extends Error {
  public readonly name: string;
  public readonly isOperational: boolean;
  public readonly httpCode?: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    name: string,
    message: string,
    httpCode?: number,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    
    this.name = name;
    this.isOperational = isOperational;
    this.httpCode = httpCode;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      httpCode: this.httpCode,
      isOperational: this.isOperational,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends BaseError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super('ConfigValidationError', message, 500, true, { validationErrors });
    this.validationErrors = validationErrors;
  }
}

/**
 * Database operation error
 */
export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('DatabaseError', message, 500, true, context);
  }
}

/**
 * Kafka operation error
 */
export class KafkaError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('KafkaError', message, 500, true, context);
  }
}

/**
 * API call error
 */
export class ApiError extends BaseError {
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: unknown,
    context?: Record<string, unknown>
  ) {
    super('ApiError', message, statusCode || 500, true, context);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('AuthenticationError', message, 401, true, context);
  }
}

/**
 * Business logic validation error
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = [], context?: Record<string, unknown>) {
    super('ValidationError', message, 400, true, context);
    this.validationErrors = validationErrors;
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('NotFoundError', message, 404, true, context);
  }
}

/**
 * Challenge processing error
 */
export class ChallengeProcessingError extends BaseError {
  public readonly challengeId?: string;
  public readonly legacyId?: number;

  constructor(
    message: string,
    challengeId?: string,
    legacyId?: number,
    context?: Record<string, unknown>
  ) {
    super('ChallengeProcessingError', message, 422, true, { 
      challengeId, 
      legacyId, 
      ...context 
    });
    this.challengeId = challengeId;
    this.legacyId = legacyId;
  }
}

/**
 * Rating calculation error
 */
export class RatingCalculationError extends BaseError {
  public readonly challengeId?: string;
  public readonly step?: string;

  constructor(
    message: string,
    challengeId?: string,
    step?: string,
    context?: Record<string, unknown>
  ) {
    super('RatingCalculationError', message, 422, true, { 
      challengeId, 
      step, 
      ...context 
    });
    this.challengeId = challengeId;
    this.step = step;
  }
}

/**
 * Type guard to check if an error is operational
 */
export function isOperationalError(error: Error): error is BaseError {
  return error instanceof BaseError && error.isOperational;
}

/**
 * Error handler utility
 */
import logger from './logger';

export class ErrorHandler {
  /**
   * Handle operational errors
   */
  public static handleOperationalError(error: BaseError): void {
    logger.error('Operational error occurred:', error.toJSON());
  }

  /**
   * Handle programmer errors
   */
  public static handleProgrammerError(error: Error): void {
    logger.error('Programmer error occurred:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Determine if error is operational
   */
  public static isOperational(error: Error): boolean {
    return isOperationalError(error);
  }
}

/**
 * Error middleware for async functions
 */
export function asyncErrorHandler<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (ErrorHandler.isOperational(error as Error)) {
        ErrorHandler.handleOperationalError(error as BaseError);
      } else {
        ErrorHandler.handleProgrammerError(error as Error);
      }
      throw error;
    }
  };
} 