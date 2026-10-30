import { Body, Controller, Delete, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { fieldValidationException, strictValidationPipe } from '../common/validation';
import type { AuthenticatedRequest } from '../common/session';
import { SizeGuidesService } from './size-guides.service';
import { CreateSizeGuideDto, UpdateSizeGuideDto } from './dto/size-guide.dto';

@Controller()
@UsePipes(strictValidationPipe)
export class SizeGuidesController {
  constructor(private readonly sizeGuides: SizeGuidesService) {}

  /** Active size guides with their linked categories (storefront page + product dialog). */
  @Get('size-guides')
  listActive() {
    return this.sizeGuides.listActive();
  }

  @Get('admin/size-guides')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  listAll() {
    return this.sizeGuides.listAll();
  }

  @Get('admin/size-guides/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.sizeGuides.findById(id);
  }

  @Post('admin/size-guides')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  create(@Body() body: CreateSizeGuideDto) {
    return this.sizeGuides.create(body);
  }

  @Put('admin/size-guides/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: UpdateSizeGuideDto) {
    return this.sizeGuides.update(id, body);
  }

  @Delete('admin/size-guides/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.sizeGuides.remove(id);
  }

  @Post('admin/size-guides/:id/image')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file?.buffer) {
      throw fieldValidationException([{ field: 'file', code: 'required', message: 'An image file is required' }]);
    }
    const userId = (req as AuthenticatedRequest).user?.id;
    return this.sizeGuides.uploadImage(id, file.buffer, file.originalname, file.mimetype, userId);
  }

  @Delete('admin/size-guides/:id/image')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  removeImage(@Param('id') id: string) {
    return this.sizeGuides.removeImage(id);
  }
}
