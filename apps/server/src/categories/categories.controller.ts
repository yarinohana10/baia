import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AuthGuard, Roles } from '../auth/auth.guard';

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
}
