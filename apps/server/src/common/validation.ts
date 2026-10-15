import {
  BadRequestException,
  ConflictException,
  ValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

/**
 * A single field-level error returned to API clients.
 *
 * `field` is a dotted path into the request payload (e.g. `variants.2.sku`),
 * `code` is a stable machine-readable reason the client can translate
 * (e.g. `isNotEmpty`, `min`, `unique`, `saleBelowPrice`).
 */
export type FieldError = {
  field: string;
  code: string;
  message: string;
};

/** Shape of every 400/409 body produced by validation or uniqueness checks. */
export type FieldErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  errors: FieldError[];
};

/** Flattens nested class-validator errors into dotted-path field errors. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  const result: FieldError[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      for (const [code, message] of Object.entries(err.constraints)) {
        result.push({ field: path, code, message });
      }
    }
    if (err.children && err.children.length > 0) {
      result.push(...flattenValidationErrors(err.children, path));
    }
  }
  return result;
}

function body(statusCode: number, error: string, errors: FieldError[]): FieldErrorResponse {
  return {
    statusCode,
    error,
    message: errors[0]?.message ?? error,
    errors,
  };
}

export function fieldValidationException(errors: FieldError[]): BadRequestException {
  return new BadRequestException(body(400, 'Bad Request', errors));
}

export function fieldConflictException(errors: FieldError[]): ConflictException {
  return new ConflictException(body(409, 'Conflict', errors));
}

export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  exceptionFactory: (errors: ValidationError[]) =>
    fieldValidationException(flattenValidationErrors(errors)),
};

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe(VALIDATION_PIPE_OPTIONS);
}
