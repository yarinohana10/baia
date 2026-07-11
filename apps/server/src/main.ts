import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { authRouter } from './auth/auth.router';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Mount better-auth routes before NestJS global prefix
  app.use(authRouter);

  // Serve uploaded files statically
  const uploadsDir = process.env.UPLOADS_DIR || './uploads';
  app.useStaticAssets(join(process.cwd(), uploadsDir), { prefix: '/uploads' });

  app.setGlobalPrefix('v1');

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Baia API running on http://localhost:${port}`);
}
bootstrap();
