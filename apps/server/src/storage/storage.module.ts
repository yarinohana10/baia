import { Global, Module, type Type } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE, type StorageService } from './storage.interface';

/**
 * STORAGE_PROVIDER=s3 -> S3-compatible bucket; anything else -> local disk.
 * Production refuses local disk: container filesystems (Railway) are
 * ephemeral, so every deploy would silently delete all uploaded images.
 */
export function resolveStorageProvider(env: Record<string, string | undefined> = process.env): Type<StorageService> {
  const provider = env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (provider === 's3') return S3StorageService;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      `STORAGE_PROVIDER=${provider || '(unset)'} is not allowed in production: uploads would be lost on every deploy. ` +
        'Set STORAGE_PROVIDER=s3 with an S3-compatible bucket (see docs/DEPLOYMENT.md).',
    );
  }
  return LocalStorageService;
}

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: resolveStorageProvider(),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
