import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma';
import { FieldErrorResponse } from './validation';

/** Extracts the column names involved in a unique-constraint violation. */
export function uniqueTargetFields(meta: Record<string, unknown> | undefined): string[] {
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') {
    // Postgres constraint names look like `products_slug_key` / `product_variants_sku_key`
    if (target.endsWith('_key')) {
      const parts = target.slice(0, -4).split('_');
      return [parts[parts.length - 1]];
    }
    return [target];
  }
  return [];
}

/**
 * Maps known Prisma errors to friendly HTTP responses instead of raw 500s:
 * - P2002 unique violation   -> 409 with the conflicting field(s)
 * - P2025 record not found   -> 404
 * - P2003 foreign key failed -> 409 (record is referenced / missing relation)
 */
export function mapPrismaError(
  err: Prisma.PrismaClientKnownRequestError,
): FieldErrorResponse | null {
  switch (err.code) {
    case 'P2002': {
      const fields = uniqueTargetFields(err.meta as Record<string, unknown>);
      const errors = (fields.length ? fields : ['unknown']).map((field) => ({
        field,
        code: 'unique',
        message: `A record with this ${field} already exists`,
      }));
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: errors[0].message,
        errors,
      };
    }
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Record not found',
        errors: [],
      };
    case 'P2003': {
      const field = String((err.meta as Record<string, unknown>)?.field_name ?? 'relation');
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'The record is referenced by other data or a related record is missing',
        errors: [{ field, code: 'foreignKey', message: 'Related record conflict' }],
      };
    }
    default:
      return null;
  }
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = mapPrismaError(exception);
    if (!mapped || host.getType() !== 'http') {
      return super.catch(exception, host);
    }
    const res = host.switchToHttp().getResponse<Response>();
    res.status(mapped.statusCode).json(mapped);
  }
}
