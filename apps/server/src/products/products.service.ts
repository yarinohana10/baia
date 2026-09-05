import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { Prisma } from '../generated/prisma';
import { randomUUID } from 'crypto';

type ImageWithUpload = {
  id: string;
  url: string;
  upload: { s3Key: string } | null;
  [key: string]: unknown;
};

type ProductWithImages = {
  images?: ImageWithUpload[];
  [key: string]: unknown;
};

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private resolveImageUrl(image: ImageWithUpload): ImageWithUpload {
    if (image.upload) {
      return { ...image, url: this.storage.getUrl(image.upload.s3Key) };
    }
    return image;
  }

  private resolveProductImages<T extends ProductWithImages>(product: T): T {
    if (product.images) {
      return { ...product, images: product.images.map((img) => this.resolveImageUrl(img)) };
    }
    return product;
  }

  async findAll(params?: {
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const { categoryId, search, page = 1, limit = 20, sort = 'newest' } = params || {};

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (categoryId) {
      const childCategories = await this.prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });

      if (childCategories.length > 0) {
        where.categoryId = { in: [categoryId, ...childCategories.map((c) => c.id)] };
      } else {
        where.categoryId = categoryId;
      }
    }

    if (search) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameHe: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === 'price-asc' ? { basePrice: 'asc' } :
      sort === 'price-desc' ? { basePrice: 'desc' } :
      { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: { where: { isActive: true } },
          images: { orderBy: { sortOrder: 'asc' }, include: { upload: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => this.resolveProductImages(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllAdmin(params?: { search?: string; categoryId?: string }) {
    const where: Prisma.ProductWhereInput = {};
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.search) {
      where.OR = [
        { nameEn: { contains: params.search, mode: 'insensitive' } },
        { nameHe: { contains: params.search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: params.search, mode: 'insensitive' } } } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
        images: { orderBy: { sortOrder: 'asc' }, include: { upload: true } },
        _count: { select: { variants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => this.resolveProductImages(p));
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: { include: { parent: true } },
        variants: { where: { isActive: true }, orderBy: { color: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' }, include: { upload: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.resolveProductImages(product);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        images: { orderBy: { sortOrder: 'asc' }, include: { upload: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.resolveProductImages(product);
  }

  async create(data: {
    nameHe: string;
    nameEn: string;
    descriptionHe?: string;
    descriptionEn?: string;
    slug: string;
    basePrice: number;
    categoryId: string;
    isFeatured?: boolean;
  }) {
    if (!data.categoryId) {
      throw new BadRequestException('Every product must be assigned to a category');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Category with id "${data.categoryId}" does not exist`);
    }

    return this.prisma.product.create({
      data: {
        ...data,
        basePrice: new Prisma.Decimal(data.basePrice),
      },
      include: { category: true, variants: true, images: true },
    });
  }

  async update(id: string, data: Partial<{
    nameHe: string;
    nameEn: string;
    descriptionHe: string;
    descriptionEn: string;
    slug: string;
    basePrice: number;
    categoryId: string;
    isFeatured: boolean;
    isActive: boolean;
  }>) {
    await this.findById(id);

    if (data.categoryId !== undefined) {
      if (!data.categoryId) {
        throw new BadRequestException('Cannot remove category from a product — every product must belong to a category');
      }
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category with id "${data.categoryId}" does not exist`);
      }
    }

    const updateData: any = { ...data };
    if (data.basePrice !== undefined) {
      updateData.basePrice = new Prisma.Decimal(data.basePrice);
    }
    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        variants: true,
        images: { orderBy: { sortOrder: 'asc' }, include: { upload: true } },
      },
    }).then((p) => this.resolveProductImages(p));
  }

  async delete(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { include: { upload: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    for (const image of product.images) {
      if (image.upload) {
        await this.storage.delete(image.upload.s3Key);
        await this.prisma.upload.delete({ where: { id: image.upload.id } });
      }
    }

    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Variants ────────────────────────────────────

  async createVariant(productId: string, data: {
    color: string;
    size: string;
    sku: string;
    stockQuantity: number;
    priceOverride?: number;
    salePrice?: number;
    saleStart?: string;
    saleEnd?: string;
  }) {
    return this.prisma.productVariant.create({
      data: {
        productId,
        color: data.color,
        size: data.size,
        sku: data.sku,
        stockQuantity: data.stockQuantity,
        priceOverride: data.priceOverride ? new Prisma.Decimal(data.priceOverride) : null,
        salePrice: data.salePrice ? new Prisma.Decimal(data.salePrice) : null,
        saleStart: data.saleStart ? new Date(data.saleStart) : null,
        saleEnd: data.saleEnd ? new Date(data.saleEnd) : null,
      },
    });
  }

  async updateVariant(variantId: string, data: Partial<{
    color: string;
    size: string;
    sku: string;
    stockQuantity: number;
    priceOverride: number | null;
    salePrice: number | null;
    saleStart: string | null;
    saleEnd: string | null;
    isActive: boolean;
  }>) {
    const updateData: any = { ...data };
    if (data.priceOverride !== undefined) {
      updateData.priceOverride = data.priceOverride ? new Prisma.Decimal(data.priceOverride) : null;
    }
    if (data.salePrice !== undefined) {
      updateData.salePrice = data.salePrice ? new Prisma.Decimal(data.salePrice) : null;
    }
    if (data.saleStart !== undefined) {
      updateData.saleStart = data.saleStart ? new Date(data.saleStart) : null;
    }
    if (data.saleEnd !== undefined) {
      updateData.saleEnd = data.saleEnd ? new Date(data.saleEnd) : null;
    }
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });
  }

  async deleteVariant(variantId: string) {
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { deleted: true };
  }

  // ─── Images ──────────────────────────────────────

  async uploadImage(
    productId: string,
    file: Buffer,
    originalName: string,
    mimeType: string,
    color?: string,
    uploadedBy?: string,
  ) {
    const ext = originalName.split('.').pop() || 'jpg';
    const uploadId = randomUUID();
    const s3Key = `products/${productId}/${uploadId}.${ext}`;
    const bucket = process.env.S3_BUCKET || 'baia-assets';

    const url = await this.storage.upload(file, s3Key, mimeType);

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

      const maxSort = await this.prisma.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
      });

      return await this.prisma.productImage.create({
        data: {
          productId,
          url,
          uploadId: upload.id,
          color,
          sortOrder: (maxSort._max.sortOrder || 0) + 1,
        },
        include: { upload: true },
      });
    } catch (err) {
      // DB write failed — clean up the S3 object to prevent orphans
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }
  }

  async deleteImage(imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
      include: { upload: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    if (image.upload) {
      await this.storage.delete(image.upload.s3Key);
      await this.prisma.productImage.delete({ where: { id: imageId } });
      await this.prisma.upload.delete({ where: { id: image.upload.id } });
    } else {
      await this.prisma.productImage.delete({ where: { id: imageId } });
    }

    return { deleted: true };
  }
}
