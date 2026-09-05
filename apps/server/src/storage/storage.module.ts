import { Global, Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

const storageProvider = process.env.STORAGE_PROVIDER === 's3'
  ? S3StorageService
  : LocalStorageService;

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: storageProvider,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
