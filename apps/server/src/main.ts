import './config/load-env';
// Must stay second: fails fast with every missing/invalid variable before any
// module reads its config at import time.
import './config/validate-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { authRouter } from './auth/auth.router';
import { join } from 'path';
import { configureGlobalPipeline, configureHttpServer } from './common/app-setup';
import { getConfig } from './config/env';

async function bootstrap() {
  const config = getConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  configureHttpServer(app, config);

  // Mount better-auth routes before NestJS global prefix
  app.use(authRouter);

  // Serve uploaded files statically (local storage only; production uses S3)
  app.useStaticAssets(join(process.cwd(), config.storage.uploadsDir), { prefix: '/uploads' });

  app.setGlobalPrefix('v1');

  // Global DTO validation (whitelist + transform) and Prisma error mapping
  configureGlobalPipeline(app);

  // No host argument: Node listens on "::" (IPv4 + IPv6), which Railway's
  // private network (IPv6) needs.
  await app.listen(config.port);
  new Logger('Bootstrap').log(
    `Baia API listening on port ${config.port} (${config.nodeEnv}); public auth origin ${config.auth.baseUrl}; ` +
      `allowed origins ${config.allowedOrigins.join(', ')}`,
  );
}
bootstrap();
