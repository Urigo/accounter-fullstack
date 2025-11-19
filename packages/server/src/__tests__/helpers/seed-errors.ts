/**
 * Base error class for seed operations
 * Provides structured context for debugging seed failures
 */
export class SeedError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown>,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'SeedError';
    
    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Format error with context for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}

/**
 * Thrown when entity validation fails (invalid type, missing required fields, etc.)
 */
export class EntityValidationError extends SeedError {
  constructor(
    entityType: string,
    validationErrors: string[],
    context?: Record<string, unknown>,
  ) {
    super(
      `${entityType} validation failed: ${validationErrors.join(', ')}`,
      { entityType, validationErrors, ...context },
    );
    this.name = 'EntityValidationError';
  }
}

/**
 * Thrown when attempting to reference an entity that doesn't exist
 */
export class EntityNotFoundError extends SeedError {
  constructor(entityType: string, identifier: Record<string, unknown>) {
    super(
      `${entityType} not found`,
      { entityType, identifier },
    );
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Thrown when database constraint violation occurs during seed
 */
export class ConstraintViolationError extends SeedError {
  constructor(
    constraintName: string,
    operation: string,
    context: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      `Constraint violation: ${constraintName} during ${operation}`,
      { constraintName, operation, ...context },
      cause,
    );
    this.name = 'ConstraintViolationError';
  }
}

/**
 * Thrown when seed configuration is invalid or missing
 */
export class SeedConfigurationError extends SeedError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context || {});
    this.name = 'SeedConfigurationError';
  }
}
