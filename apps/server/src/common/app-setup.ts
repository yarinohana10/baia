import { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createValidationPipe } from './validation';
import { PrismaExceptionFilter } from './prisma-exception.filter';

/**
 * Global request validation + error mapping. Shared by `main.ts` and the
 * HTTP-level tests so both run the exact same pipeline.
 */
export function configureGlobalPipeline(app: INestApplication) {
  app.useGlobalPipes(createValidationPipe());
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapter));
}
