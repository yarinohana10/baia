import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { imageUploadOptions } from '../storage/image-upload.guard';
import { SizeGuidesController } from './size-guides.controller';
import { SizeGuidesService } from './size-guides.service';

@Module({
  imports: [AuthModule, MulterModule.register(imageUploadOptions)],
  controllers: [SizeGuidesController],
  providers: [SizeGuidesService],
})
export class SizeGuidesModule {}
