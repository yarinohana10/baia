import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { randomUUID } from 'crypto';

type CategoryWithUpload = {
  image: string | null;
  imageUpload: { s3Key: string } | null;
  [key: string]: unknown;
};

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private resolveCategoryImage<T extends CategoryWithUpload>(category: T): T {
    if (category.imageUpload) {
      return { ...category, image: this.storage.getUrl(category.imageUpload.s3Key) };
    }
    return category;
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: { imageUpload: true },
        },
        imageUpload: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((cat) => ({
      ...this.resolveCategoryImage(cat),
      children: cat.children.map((child: any) => this.resolveCategoryImage(child)),
    }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { sortOrder: 'asc' }, include: { imageUpload: true } },
        parent: { include: { imageUpload: true } },
        imageUpload: true,
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return {
      ...this.resolveCategoryImage(category),
      children: category.children.map((child: any) => this.resolveCategoryImage(child)),
      parent: category.parent ? this.resolveCategoryImage(category.parent) : null,
    };
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: { orderBy: { sortOrder: 'asc' }, include: { imageUpload: true } },
        parent: { include: { imageUpload: true } },
        imageUpload: true,
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.resolveCategoryImage(category);
  }

  async create(data: {
    nameHe: string;
    nameEn: string;
    slug: string;
    parentId?: string;
    image?: string;
    sortOrder?: number;
  }) {
    return this.prisma.category.create({
      data,
      include: { imageUpload: true },
    });
  }

  async update(
    id: string,
    data: {
      nameHe?: string;
      nameEn?: string;
      slug?: string;
      parentId?: string | null;
      image?: string;
      sortOrder?: number;
    },
  ) {
    await this.findById(id);
    return this.prisma.category.update({
      where: { id },
      data,
      include: { imageUpload: true },
    });
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { imageUpload: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category.imageUpload) {
      await this.storage.delete(category.imageUpload.s3Key);
      await this.prisma.upload.delete({ where: { id: category.imageUpload.id } });
    }

    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  async uploadImage(
    categoryId: string,
    file: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy?: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { imageUpload: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Delete old upload if exists
    if (category.imageUpload) {
      await this.storage.delete(category.imageUpload.s3Key);
      await this.prisma.upload.delete({ where: { id: category.imageUpload.id } });
    }

    const ext = originalName.split('.').pop() || 'jpg';
    const uploadIdValue = randomUUID();
    const s3Key = `categories/${categoryId}/${uploadIdValue}.${ext}`;
    const bucket = process.env.S3_BUCKET || 'baia-assets';

    await this.storage.upload(file, s3Key, mimeType);

    try {
      const upload = await this.prisma.upload.create({
        data: {
          s3Key,
          s3Bucket: bucket,
          mimeType,
          sizeBytes: file.length,
          fileName: originalName,
          uploadedBy,
        },
      });

      const updated = await this.prisma.category.update({
        where: { id: categoryId },
        data: { imageUploadId: upload.id },
        include: { imageUpload: true },
      });

      return this.resolveCategoryImage(updated);
    } catch (err) {
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }
  }

  async deleteImage(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { imageUpload: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (!category.imageUpload) throw new NotFoundException('Category has no image');

    await this.storage.delete(category.imageUpload.s3Key);
    await this.prisma.category.update({
      where: { id: categoryId },
      data: { imageUploadId: null },
    });
    await this.prisma.upload.delete({ where: { id: category.imageUpload.id } });

    return { deleted: true };
  }
}
