import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { Request } from 'express';
import { JsonBody, JsonBodyValidationPipe } from '../common/json-body.decorator';
import {
  CreateProductDto,
  ImageMetaDto,
  MAX_IMAGES_PER_REQUEST,
  ReorderImagesDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantDto,
} from './dto/product.dto';
import { ADMIN_PAGE_LIMIT, clampInt, MAX_PAGE, PUBLIC_PAGE_LIMIT } from './pagination';

function userIdOf(req?: Request): string | undefined {
  return (req as unknown as { user?: { id?: string } } | undefined)?.user?.id;
}

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
      search: search?.trim().slice(0, 100) || undefined,
      page: clampInt(page, 1, 1, MAX_PAGE),
      limit: clampInt(limit, PUBLIC_PAGE_LIMIT.default, 1, PUBLIC_PAGE_LIMIT.max),
      sort,
    });
  }

  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get('size-sets')
  listSizeSets() {
    return this.productsService.listSizeSets();
  }

  // ─── Admin: Products ─────────────────────────────

  @Get('admin/products')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  /**
   * Backward compatible: without `page` this returns a plain array of every
   * product (what the current admin products page expects). With `page`
   * (and optional `limit`, default 50, max 200) it returns
   * `{ products, total, page, limit, totalPages }`.
   */
  findAllAdmin(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (page === undefined) {
      return this.productsService.findAllAdmin({ search, categoryId });
    }
    return this.productsService.findAllAdminPage({
      search,
      categoryId,
      page: clampInt(page, 1, 1, MAX_PAGE),
      limit: clampInt(limit, ADMIN_PAGE_LIMIT.default, 1, ADMIN_PAGE_LIMIT.max),
    });
  }

  @Get('admin/products/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  /**
   * Creates a product with variants and (optionally) images in one request.
   * Accepts either JSON, or multipart/form-data with a JSON `payload` field
   * plus `images` files (metadata in `payload.images`, aligned by index).
   */
  @Post('admin/products')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseInterceptors(FilesInterceptor('images', MAX_IMAGES_PER_REQUEST))
  create(
    @JsonBody('payload', JsonBodyValidationPipe) body: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: Request,
  ) {
    return this.productsService.create(body, files ?? [], userIdOf(req));
  }

  @Put('admin/products/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productsService.update(id, body);
  }

  /**
   * Returns `{ deleted: true }`, or `{ archived: true }` when the product has
   * been ordered (it is hidden instead so order history stays intact).
   */
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
  createVariant(@Param('id') productId: string, @Body() body: VariantDto) {
    return this.productsService.createVariant(productId, body);
  }

  @Put('admin/variants/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  updateVariant(@Param('id') id: string, @Body() body: UpdateVariantDto) {
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
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() meta: ImageMetaDto,
    @Req() req: Request,
  ) {
    return this.productsService.uploadImage(productId, file, meta, userIdOf(req));
  }

  @Put('admin/products/:id/images/order')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  reorderImages(@Param('id') productId: string, @Body() body: ReorderImagesDto) {
    return this.productsService.reorderImages(productId, body.imageIds);
  }

  @Patch('admin/images/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  updateImage(@Param('id') id: string, @Body() body: ImageMetaDto) {
    return this.productsService.updateImage(id, body);
  }

  @Delete('admin/images/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  deleteImage(@Param('id') id: string) {
    return this.productsService.deleteImage(id);
  }
}
