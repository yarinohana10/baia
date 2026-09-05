import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SiteConfigController } from './site-config.controller';
import { SiteConfigService } from './site-config.service';
import { AuthModule } from '../auth/auth.module';
import { imageUploadOptions } from '../storage/image-upload.guard';

@Module({
  imports: [
    AuthModule,
    MulterModule.register(imageUploadOptions),
  ],
  controllers: [SiteConfigController],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
