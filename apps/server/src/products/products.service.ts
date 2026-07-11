import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { Prisma } from '../generated/prisma';
import { randomUUID } from 'crypto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

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
      where.categoryId = categoryId;
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
          images: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    return this.prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: true,
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { variants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: { include: { parent: true } },
        variants: { where: { isActive: true }, orderBy: { color: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
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
    const updateData: any = { ...data };
    if (data.basePrice !== undefined) {
      updateData.basePrice = new Prisma.Decimal(data.basePrice);
    }
    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, variants: true, images: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
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
  }) {
    return this.prisma.productVariant.create({
      data: {
        ...data,
        productId,
        priceOverride: data.priceOverride ? new Prisma.Decimal(data.priceOverride) : null,
      },
    });
  }

  async updateVariant(variantId: string, data: Partial<{
    color: string;
    size: string;
    sku: string;
    stockQuantity: number;
    priceOverride: number | null;
    isActive: boolean;
  }>) {
    const updateData: any = { ...data };
    if (data.priceOverride !== undefined) {
      updateData.priceOverride = data.priceOverride ? new Prisma.Decimal(data.priceOverride) : null;
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
  ) {
    const ext = originalName.split('.').pop() || 'jpg';
    const key = `products/${productId}/${randomUUID()}.${ext}`;
    const url = await this.storage.upload(file, key, mimeType);

    const maxSort = await this.prisma.productImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });

    return this.prisma.productImage.create({
      data: {
        productId,
        url,
        color,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
      },
    });
  }

  async deleteImage(imageId: string) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');

    const urlParts = image.url.split('/uploads/');
    if (urlParts[1]) {
      await this.storage.delete(urlParts[1]);
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { deleted: true };
  }
}
