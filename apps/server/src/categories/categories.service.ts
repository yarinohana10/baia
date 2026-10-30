import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { randomUUID } from 'crypto';
import { FieldError, fieldConflictException, fieldValidationException } from '../common/validation';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

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
      children: cat.children.map((child) => this.resolveCategoryImage(child)),
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
      children: category.children.map((child) => this.resolveCategoryImage(child)),
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

  async create(data: CreateCategoryDto) {
    if (data.parentId) await this.assertValidParent(null, data.parentId);
    if (data.sizeGuideId) await this.assertSizeGuideExists(data.sizeGuideId);
    return this.prisma.category.create({
      data,
      include: { imageUpload: true },
    });
  }

  async update(id: string, data: UpdateCategoryDto) {
    await this.findById(id);
    if (data.parentId) await this.assertValidParent(id, data.parentId);
    if (data.sizeGuideId) await this.assertSizeGuideExists(data.sizeGuideId);
    return this.prisma.category.update({
      where: { id },
      data,
      include: { imageUpload: true },
    });
  }

  private async assertSizeGuideExists(sizeGuideId: string) {
    const found = await this.prisma.sizeGuide.findUnique({ where: { id: sizeGuideId }, select: { id: true } });
    if (!found) {
      throw fieldValidationException([{ field: 'sizeGuideId', code: 'notFound', message: 'Size guide does not exist' }]);
    }
  }

  /**
   * Hierarchy rules (the storefront shows two levels, e.g. Men › Swim Shorts):
   * - a category cannot be its own parent or sit under one of its descendants
   * - the parent must be a top-level category, and a category that has
   *   subcategories cannot itself be moved under another one
   * - products live only in leaf categories, so a category that already has
   *   products cannot receive subcategories (409)
   */
  private async assertValidParent(categoryId: string | null, parentId: string) {
    const invalid = (code: string, message: string) =>
      fieldValidationException([{ field: 'parentId', code, message }]);

    if (categoryId && parentId === categoryId) {
      throw invalid('selfParent', 'A category cannot be its own parent');
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      include: { _count: { select: { products: true } } },
    });
    if (!parent) throw invalid('notFound', 'Parent category does not exist');

    if (categoryId) {
      // Walk up from the new parent; reaching the category means a cycle.
      let cursor: string | null = parent.parentId;
      for (let depth = 0; cursor && depth < 50; depth++) {
        if (cursor === categoryId) {
          throw invalid('descendantParent', 'A category cannot be moved under one of its subcategories');
        }
        const next: { parentId: string | null } | null = await this.prisma.category.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = next?.parentId ?? null;
      }
    }

    if (parent.parentId) {
      throw invalid('maxDepth', 'Subcategories can only be added under a top-level category');
    }

    if (categoryId) {
      const childCount = await this.prisma.category.count({ where: { parentId: categoryId } });
      if (childCount > 0) {
        throw invalid('hasSubcategories', 'A category that has subcategories cannot be moved under another category');
      }
    }

    if ((parent._count?.products ?? 0) > 0) {
      throw fieldConflictException([
        {
          field: 'parentId',
          code: 'parentHasProducts',
          message: 'The parent category has products; move them to a subcategory first',
        },
      ]);
    }
  }

  /**
   * Deletes an empty category. Categories with products or subcategories are
   * refused with 409 (codes `hasProducts` / `hasSubcategories`). The image is
   * removed from storage only after the database delete succeeds.
   */
  async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { imageUpload: true, _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');

    const conflicts: FieldError[] = [];
    if ((category._count?.children ?? 0) > 0) {
      conflicts.push({
        field: 'children',
        code: 'hasSubcategories',
        message: 'Delete or move the subcategories first',
      });
    }
    if ((category._count?.products ?? 0) > 0) {
      conflicts.push({
        field: 'products',
        code: 'hasProducts',
        message: 'Move or delete the products in this category first',
      });
    }
    if (conflicts.length) throw fieldConflictException(conflicts);

    await this.prisma.category.delete({ where: { id } });

    if (category.imageUpload) {
      await this.prisma.upload.delete({ where: { id: category.imageUpload.id } }).catch(() => {});
      await this.storage.delete(category.imageUpload.s3Key).catch(() => {});
    }
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

    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const uploadIdValue = randomUUID();
    const s3Key = `categories/${categoryId}/${uploadIdValue}.${ext}`;
    const bucket = process.env.S3_BUCKET || 'baia-assets';

    // New image first: if anything fails the category keeps its current image.
    await this.storage.upload(file, s3Key, mimeType);

    let updated;
    let uploadId: string | null = null;
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
      uploadId = upload.id;
      updated = await this.prisma.category.update({
        where: { id: categoryId },
        data: { imageUploadId: upload.id },
        include: { imageUpload: true },
      });
    } catch (err) {
      if (uploadId) await this.prisma.upload.delete({ where: { id: uploadId } }).catch(() => {});
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }

    // Then retire the previous image (a leftover object is harmless).
    if (category.imageUpload) {
      await this.prisma.upload.delete({ where: { id: category.imageUpload.id } }).catch(() => {});
      await this.storage.delete(category.imageUpload.s3Key).catch(() => {});
    }

    return this.resolveCategoryImage(updated);
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
