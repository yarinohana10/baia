import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthModule } from '../auth/auth.module';
import { imageUploadOptions } from '../storage/image-upload.guard';

@Module({
  imports: [
    AuthModule,
    MulterModule.register(imageUploadOptions),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
