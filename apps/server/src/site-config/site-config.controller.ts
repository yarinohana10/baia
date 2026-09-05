import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SiteConfigService } from './site-config.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { Request } from 'express';

@Controller()
export class SiteConfigController {
  constructor(private readonly siteConfigService: SiteConfigService) {}

  /** Public endpoint — returns hero & shipping config for storefront */
  @Get('site-config')
  getPublic() {
    return this.siteConfigService.get();
  }

  @Get('admin/site-config')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  get() {
    return this.siteConfigService.get();
  }

  @Put()
  update(
    @Body()
    body: {
      shippingCost?: number;
      freeShippingThreshold?: number;
      heroImageUrl?: string;
      heroTitleHe?: string;
      heroTitleEn?: string;
      heroSubtitleHe?: string;
      heroSubtitleEn?: string;
      heroCtaUrl?: string;
    },
  ) {
    return this.siteConfigService.update(body);
  }

  @Post('hero-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadHeroImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.siteConfigService.uploadHeroImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
    );
  }
}
