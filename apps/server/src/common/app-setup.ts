import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpAdapterHost } from '@nestjs/core';
import { createValidationPipe } from './validation';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { securityHeaders } from './security-headers';
import type { AppConfig } from '../config/env';

/**
 * Global request validation + error mapping. Shared by `main.ts` and the
 * HTTP-level tests so both run the exact same pipeline.
 */
export function configureGlobalPipeline(app: INestApplication) {
  app.useGlobalPipes(createValidationPipe());
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapter));
}

/**
 * HTTP hardening shared by main.ts: proxy trust (req.ip = real client behind
 * Railway's edge / the storefront proxy), security headers, CORS from the
 * validated origin list, body size limits and graceful shutdown.
 */
export function configureHttpServer(app: NestExpressApplication, config: AppConfig) {
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(securityHeaders({ hsts: config.isProduction }));
  app.enableCors({ origin: config.allowedOrigins, credentials: true });
  app.useBodyParser('json', { limit: config.bodyLimit });
  app.useBodyParser('urlencoded', { limit: config.bodyLimit, extended: true });
  // SIGTERM (Railway redeploys) -> onModuleDestroy hooks: stop the pending-order
  // sweeper, close Prisma connections, finish in-flight requests.
  app.enableShutdownHooks();
}
