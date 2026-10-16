import {
  BadRequestException,
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
import { strictValidationPipe } from '../common/validation';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';

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

  @Put('admin/site-config')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Body(strictValidationPipe) body: UpdateSiteConfigDto) {
    return this.siteConfigService.update(body);
  }

  @Post('admin/site-config/hero-image')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadHeroImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('An image file is required (field "file")');
    const userId = (req as unknown as { user?: { id?: string } }).user?.id;
    return this.siteConfigService.uploadHeroImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
    );
  }
}
