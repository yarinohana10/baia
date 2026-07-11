import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { AuthGuard, Roles } from '../auth/auth.guard';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Public ──────────────────────────────────────

  @Get('products')
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.productsService.findAll({
      categoryId,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      sort,
    });
  }

  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ─── Admin: Products ─────────────────────────────

  @Get('admin/products')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findAllAdmin(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productsService.findAllAdmin({ search, categoryId });
  }

  @Get('admin/products/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post('admin/products')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  create(@Body() body: {
    nameHe: string;
    nameEn: string;
    descriptionHe?: string;
    descriptionEn?: string;
    slug: string;
    basePrice: number;
    categoryId: string;
    isFeatured?: boolean;
  }) {
    return this.productsService.create(body);
  }

  @Put('admin/products/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.productsService.update(id, body);
  }

  @Delete('admin/products/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  // ─── Admin: Variants ─────────────────────────────

  @Post('admin/products/:id/variants')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  createVariant(
    @Param('id') productId: string,
    @Body() body: {
      color: string;
      size: string;
      sku: string;
      stockQuantity: number;
      priceOverride?: number;
      salePrice?: number;
      saleStart?: string;
      saleEnd?: string;
    },
  ) {
    return this.productsService.createVariant(productId, body);
  }

  @Put('admin/variants/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  updateVariant(@Param('id') id: string, @Body() body: any) {
    return this.productsService.updateVariant(id, body);
  }

  @Delete('admin/variants/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  deleteVariant(@Param('id') id: string) {
    return this.productsService.deleteVariant(id);
  }

  // ─── Admin: Images ───────────────────────────────

  @Post('admin/products/:id/images')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('color') color?: string,
  ) {
    return this.productsService.uploadImage(
      productId,
      file.buffer,
      file.originalname,
      file.mimetype,
      color,
    );
  }

  @Delete('admin/images/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  deleteImage(@Param('id') id: string) {
    return this.productsService.deleteImage(id);
  }
}
