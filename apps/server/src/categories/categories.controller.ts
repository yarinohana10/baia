import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategoriesService } from './categories.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { Request } from 'express';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('categories/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Post('admin/categories')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  create(
    @Body()
    body: {
      nameHe: string;
      nameEn: string;
      slug: string;
      parentId?: string;
      image?: string;
      sortOrder?: number;
    },
  ) {
    return this.categoriesService.create(body);
  }

  @Put('admin/categories/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      nameHe?: string;
      nameEn?: string;
      slug?: string;
      parentId?: string | null;
      image?: string;
      sortOrder?: number;
    },
  ) {
    return this.categoriesService.update(id, body);
  }

  @Delete('admin/categories/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }

  @Post('admin/categories/:id/image')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.categoriesService.uploadImage(
      id,
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
    );
  }

  @Delete('admin/categories/:id/image')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  deleteImage(@Param('id') id: string) {
    return this.categoriesService.deleteImage(id);
  }
}
