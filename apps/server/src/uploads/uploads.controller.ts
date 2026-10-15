import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { Request } from 'express';

@Controller('admin/uploads')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.uploadsService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
      'general',
      userId,
    );
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.uploadsService.findById(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.uploadsService.delete(id);
  }
}
