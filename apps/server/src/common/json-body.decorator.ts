import { createParamDecorator, ExecutionContext, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { fieldValidationException, VALIDATION_PIPE_OPTIONS } from './validation';

/**
 * Reads a JSON request body that may arrive either as `application/json` or,
 * for endpoints that also accept files, as a JSON string in a multipart field
 * (default `payload`). Pair with `JsonBodyValidationPipe` to validate the DTO.
 */
export const JsonBody = createParamDecorator((field: string | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const name = field ?? 'payload';
  const raw = (req.body as Record<string, unknown> | undefined)?.[name];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw fieldValidationException([
        { field: name, code: 'isJson', message: `${name} must be valid JSON` },
      ]);
    }
  }
  return req.body ?? {};
});

/** ValidationPipe that also validates values produced by custom decorators. */
export const JsonBodyValidationPipe = new ValidationPipe({
  ...VALIDATION_PIPE_OPTIONS,
  validateCustomDecorators: true,
});
