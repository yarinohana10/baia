import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { Prisma } from '../generated/prisma';
import { randomUUID } from 'crypto';
import {
  FieldError,
  fieldConflictException,
  fieldValidationException,
} from '../common/validation';
import {
  CreateProductDto,
  ImageMetaDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantDto,
} from './dto/product.dto';
import { compareSizes } from './size-sets';

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

/** Minimal file shape (subset of Express.Multer.File) the service needs. */
export type IncomingFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size?: number;
};

type PricingFields = {
  priceOverride?: number | null;
  salePrice?: number | null;
  saleStart?: string | Date | null;
  saleEnd?: string | Date | null;
};

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function toNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return value.toNumber();
}

function decimalOrNull(value: number | null | undefined) {
  return value === null || value === undefined ? null : new Prisma.Decimal(value);
}

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

const IMAGE_INCLUDE = { orderBy: { sortOrder: 'asc' }, include: { upload: true } } as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

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

  private get bucket() {
    return process.env.S3_BUCKET || 'baia-assets';
  }

  // ─── Size sets ───────────────────────────────────

  listSizeSets() {
    return this.prisma.sizeSet.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  // ─── Queries ─────────────────────────────────────

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
          images: IMAGE_INCLUDE,
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
        images: IMAGE_INCLUDE,
        _count: { select: { variants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => this.resolveProductImages(p));
  }

  /** Public product page lookup — hidden (inactive) products are not exposed. */
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: { include: { parent: true } },
        sizeSet: true,
        variants: { where: { isActive: true }, orderBy: { color: 'asc' } },
        images: IMAGE_INCLUDE,
      },
    });
    if (!product || product.isActive === false) throw new NotFoundException('Product not found');
    return this.resolveProductImages(this.sortVariantsBySize(product));
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        sizeSet: true,
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        images: IMAGE_INCLUDE,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.resolveProductImages(this.sortVariantsBySize(product));
  }

  private sortVariantsBySize<
    T extends { variants?: { color: string; size: string }[]; sizeSet?: { sizes: string[] } | null },
  >(product: T): T {
    if (!product.variants) return product;
    const order = product.sizeSet?.sizes ?? [];
    const variants = [...product.variants].sort(
      (a, b) => a.color.localeCompare(b.color) || compareSizes(a.size, b.size, order),
    );
    return { ...product, variants };
  }

  // ─── Validation helpers ──────────────────────────

  /**
   * Business rules that span fields/objects (DTOs cover per-field rules):
   * - sale price must be below the variant's effective price
   * - SKUs and color+size combinations must be unique within the payload
   */
  private variantRuleErrors(
    variants: (PricingFields & { sku?: string; color?: string; size?: string })[],
    basePrice: number,
    pathPrefix = 'variants',
  ): FieldError[] {
    const errors: FieldError[] = [];
    const skus = new Map<string, number>();
    const combos = new Map<string, number>();

    variants.forEach((v, i) => {
      const path = pathPrefix ? `${pathPrefix}.${i}` : '';
      const at = (field: string) => (path ? `${path}.${field}` : field);

      errors.push(...this.pricingErrors(v, basePrice, path));

      if (v.sku) {
        const key = v.sku.toLowerCase();
        if (skus.has(key)) {
          errors.push({ field: at('sku'), code: 'duplicate', message: `SKU "${v.sku}" is used more than once` });
        } else {
          skus.set(key, i);
        }
      }
      if (v.color && v.size) {
        const key = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
        if (combos.has(key)) {
          errors.push({
            field: at('size'),
            code: 'duplicateCombination',
            message: `Color "${v.color}" / size "${v.size}" is used more than once`,
          });
        } else {
          combos.set(key, i);
        }
      }
    });
    return errors;
  }

  private pricingErrors(v: PricingFields, basePrice: number, path: string): FieldError[] {
    const at = (field: string) => (path ? `${path}.${field}` : field);
    const errors: FieldError[] = [];
    const effective = v.priceOverride ?? basePrice;
    if (v.salePrice !== null && v.salePrice !== undefined && v.salePrice >= effective) {
      errors.push({
        field: at('salePrice'),
        code: 'saleBelowPrice',
        message: `salePrice must be lower than the price (${effective})`,
      });
    }
    if (v.saleStart && v.saleEnd && new Date(v.saleEnd).getTime() <= new Date(v.saleStart).getTime()) {
      errors.push({ field: at('saleEnd'), code: 'saleDateRange', message: 'saleEnd must be after saleStart' });
    }
    return errors;
  }

  private async relationErrors(data: { categoryId?: string; sizeSetId?: string | null }) {
    const errors: FieldError[] = [];
    if (data.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        errors.push({ field: 'categoryId', code: 'notFound', message: 'Category does not exist' });
      }
    }
    if (data.sizeSetId) {
      const sizeSet = await this.prisma.sizeSet.findUnique({ where: { id: data.sizeSetId } });
      if (!sizeSet) {
        errors.push({ field: 'sizeSetId', code: 'notFound', message: 'Size set does not exist' });
      }
    }
    return errors;
  }

  /** Pre-checks unique fields so the client gets precise field paths (409). */
  private async uniquenessErrors(params: {
    slug?: string;
    excludeProductId?: string;
    variants?: { id?: string; sku: string }[];
    pathPrefix?: string;
  }): Promise<FieldError[]> {
    const errors: FieldError[] = [];
    const { slug, excludeProductId, variants = [], pathPrefix = 'variants' } = params;

    if (slug) {
      const existing = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
      if (existing && existing.id !== excludeProductId) {
        errors.push({ field: 'slug', code: 'unique', message: `A product with slug "${slug}" already exists` });
      }
    }

    if (variants.length > 0) {
      const taken = await this.prisma.productVariant.findMany({
        where: { sku: { in: variants.map((v) => v.sku) } },
        select: { id: true, sku: true },
      });
      variants.forEach((v, i) => {
        const clash = taken.find((t) => t.sku === v.sku && t.id !== v.id);
        if (clash) {
          errors.push({
            field: pathPrefix ? `${pathPrefix}.${i}.sku` : 'sku',
            code: 'unique',
            message: `SKU "${v.sku}" already exists`,
          });
        }
      });
    }
    return errors;
  }

  private variantData(v: VariantDto | UpdateVariantDto) {
    const data: Prisma.ProductVariantUncheckedUpdateInput = {};
    if (v.color !== undefined) data.color = v.color;
    if (v.size !== undefined) data.size = v.size;
    if (v.sku !== undefined) data.sku = v.sku;
    if (v.stockQuantity !== undefined) data.stockQuantity = v.stockQuantity;
    if (v.priceOverride !== undefined) data.priceOverride = decimalOrNull(v.priceOverride);
    if (v.salePrice !== undefined) data.salePrice = decimalOrNull(v.salePrice);
    if (v.saleStart !== undefined) data.saleStart = dateOrNull(v.saleStart);
    if (v.saleEnd !== undefined) data.saleEnd = dateOrNull(v.saleEnd);
    if (v.isActive !== undefined) data.isActive = v.isActive;
    return data;
  }

  // ─── Image storage helpers ───────────────────────

  private imageKey(productId: string, originalName: string) {
    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    return `products/${productId}/${randomUUID()}.${ext}`;
  }

  /** Uploads files to storage; if any upload fails, already-uploaded ones are removed. */
  private async putFiles(productId: string, files: IncomingFile[]) {
    const keys = files.map((f) => this.imageKey(productId, f.originalname));
    const results = await Promise.allSettled(
      files.map((f, i) => this.storage.upload(f.buffer, keys[i], f.mimetype)),
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      await this.removeKeys(keys.filter((_, i) => results[i].status === 'fulfilled'));
      throw (failed as PromiseRejectedResult).reason;
    }
    return keys.map((key, i) => ({ key, url: (results[i] as PromiseFulfilledResult<string>).value }));
  }

  private async removeKeys(keys: string[]) {
    await Promise.all(
      keys.map((key) =>
        this.storage.delete(key).catch((err) => {
          this.logger.warn(`Failed to clean up storage object ${key}: ${err}`);
        }),
      ),
    );
  }

  // ─── Products: create / update / delete ──────────

  /**
   * Creates a product with its variants and images atomically.
   * Files are uploaded to storage first; the product, variants, Upload and
   * ProductImage rows are then written in a single transaction. If the
   * transaction fails, the uploaded storage objects are deleted.
   */
  async create(dto: CreateProductDto, files: IncomingFile[] = [], uploadedBy?: string) {
    const variants = dto.variants ?? [];
    const imageMeta: ImageMetaDto[] = files.map((_, i) => dto.images?.[i] ?? {});

    const errors = [
      ...this.variantRuleErrors(variants, dto.basePrice),
      ...(await this.relationErrors({ categoryId: dto.categoryId, sizeSetId: dto.sizeSetId })),
    ];
    if (dto.images && dto.images.length > files.length) {
      errors.push({
        field: 'images',
        code: 'fileMissing',
        message: `${dto.images.length} image entries were sent but only ${files.length} files`,
      });
    }
    if (errors.length) throw fieldValidationException(errors);

    const conflicts = await this.uniquenessErrors({ slug: dto.slug, variants });
    if (conflicts.length) throw fieldConflictException(conflicts);

    const productId = randomUUID();
    const stored = await this.putFiles(productId, files);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        return tx.product.create({
          data: {
            id: productId,
            nameHe: dto.nameHe,
            nameEn: dto.nameEn,
            descriptionHe: dto.descriptionHe ?? null,
            descriptionEn: dto.descriptionEn ?? null,
            slug: dto.slug,
            basePrice: new Prisma.Decimal(dto.basePrice),
            categoryId: dto.categoryId,
            sizeSetId: dto.sizeSetId ?? null,
            isFeatured: dto.isFeatured ?? false,
            isActive: dto.isActive ?? true,
            variants: {
              create: variants.map((v) => ({
                color: v.color,
                size: v.size,
                sku: v.sku,
                stockQuantity: v.stockQuantity,
                priceOverride: decimalOrNull(v.priceOverride),
                salePrice: decimalOrNull(v.salePrice),
                saleStart: dateOrNull(v.saleStart),
                saleEnd: dateOrNull(v.saleEnd),
                isActive: v.isActive ?? true,
              })),
            },
            images: {
              create: stored.map((s, i) => ({
                url: s.url,
                sortOrder: i,
                color: imageMeta[i].color ?? null,
                altTextHe: imageMeta[i].altTextHe ?? null,
                altTextEn: imageMeta[i].altTextEn ?? null,
                upload: {
                  create: {
                    s3Key: s.key,
                    s3Bucket: this.bucket,
                    mimeType: files[i].mimetype,
                    sizeBytes: files[i].size ?? files[i].buffer.length,
                    fileName: files[i].originalname,
                    uploadedBy,
                  },
                },
              })),
            },
          },
          include: {
            category: true,
            sizeSet: true,
            variants: true,
            images: IMAGE_INCLUDE,
          },
        });
      });
      return this.resolveProductImages(created);
    } catch (err) {
      await this.removeKeys(stored.map((s) => s.key));
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const variants = dto.variants ?? [];
    const basePrice = dto.basePrice ?? toNumber(existing.basePrice as DecimalLike) ?? 0;
    const ownIds = new Set(existing.variants.map((v) => v.id));

    const errors = [
      ...this.variantRuleErrors(variants, basePrice),
      ...(await this.relationErrors({ categoryId: dto.categoryId, sizeSetId: dto.sizeSetId })),
    ];
    variants.forEach((v, i) => {
      if (v.id && !ownIds.has(v.id)) {
        errors.push({ field: `variants.${i}.id`, code: 'notFound', message: 'Variant does not belong to this product' });
      }
    });
    if (errors.length) throw fieldValidationException(errors);

    const conflicts = await this.uniquenessErrors({ slug: dto.slug, excludeProductId: id, variants });
    if (conflicts.length) throw fieldConflictException(conflicts);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    const scalarKeys = [
      'nameHe', 'nameEn', 'descriptionHe', 'descriptionEn', 'slug',
      'categoryId', 'isFeatured', 'isActive', 'sizeSetId',
    ] as const;
    for (const key of scalarKeys) {
      if (dto[key] !== undefined) (data as Record<string, unknown>)[key] = dto[key];
    }
    if (dto.basePrice !== undefined) data.basePrice = new Prisma.Decimal(dto.basePrice);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      for (const v of variants) {
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data: this.variantData(v) });
        } else {
          await tx.productVariant.create({
            data: { ...(this.variantData(v) as Prisma.ProductVariantUncheckedCreateInput), productId: id },
          });
        }
      }
    });

    return this.findById(id);
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

  async createVariant(productId: string, dto: VariantDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const basePrice = toNumber(product.basePrice as DecimalLike) ?? 0;
    const errors = this.pricingErrors(dto, basePrice, '');
    if (errors.length) throw fieldValidationException(errors);

    const conflicts = await this.uniquenessErrors({ variants: [dto], pathPrefix: '' });
    if (conflicts.length) throw fieldConflictException(conflicts);

    const { id: _ignored, ...rest } = dto;
    return this.prisma.productVariant.create({
      data: { ...(this.variantData(rest) as Prisma.ProductVariantUncheckedCreateInput), productId },
    });
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { basePrice: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    // Validate the merged state so partial updates can't produce invalid pricing
    const merged: PricingFields = {
      priceOverride: dto.priceOverride !== undefined ? dto.priceOverride : toNumber(variant.priceOverride as DecimalLike),
      salePrice: dto.salePrice !== undefined ? dto.salePrice : toNumber(variant.salePrice as DecimalLike),
      saleStart: dto.saleStart !== undefined ? dto.saleStart : variant.saleStart,
      saleEnd: dto.saleEnd !== undefined ? dto.saleEnd : variant.saleEnd,
    };
    const basePrice = toNumber(variant.product.basePrice as DecimalLike) ?? 0;
    const errors = this.pricingErrors(merged, basePrice, '');
    if (errors.length) throw fieldValidationException(errors);

    if (dto.sku !== undefined) {
      const conflicts = await this.uniquenessErrors({ variants: [{ id: variantId, sku: dto.sku }], pathPrefix: '' });
      if (conflicts.length) throw fieldConflictException(conflicts);
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: this.variantData(dto),
    });
  }

  /**
   * Deletes a variant. Variants referenced by orders or carts are deactivated
   * instead so order history stays intact.
   */
  async deleteVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { _count: { select: { orderItems: true, cartItems: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    if (variant._count.orderItems > 0 || variant._count.cartItems > 0) {
      await this.prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
    return { deleted: true };
  }

  // ─── Images ──────────────────────────────────────

  async uploadImage(
    productId: string,
    file: IncomingFile | undefined,
    meta: ImageMetaDto = {},
    uploadedBy?: string,
  ) {
    if (!file || !file.buffer) {
      throw fieldValidationException([{ field: 'file', code: 'required', message: 'An image file is required' }]);
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');

    const [stored] = await this.putFiles(productId, [file]);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        const maxSort = await tx.productImage.aggregate({
          where: { productId },
          _max: { sortOrder: true },
        });
        const current = maxSort._max.sortOrder;
        return tx.productImage.create({
          data: {
            product: { connect: { id: productId } },
            url: stored.url,
            color: meta.color ?? null,
            altTextHe: meta.altTextHe ?? null,
            altTextEn: meta.altTextEn ?? null,
            sortOrder: current === null || current === undefined ? 0 : current + 1,
            upload: {
              create: {
                s3Key: stored.key,
                s3Bucket: this.bucket,
                mimeType: file.mimetype,
                sizeBytes: file.size ?? file.buffer.length,
                fileName: file.originalname,
                uploadedBy,
              },
            },
          },
          include: { upload: true },
        });
      });
      return this.resolveImageUrl(image);
    } catch (err) {
      // DB write failed — clean up the storage object to prevent orphans
      await this.removeKeys([stored.key]);
      throw err;
    }
  }

  async updateImage(imageId: string, meta: ImageMetaDto) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');

    const data: Prisma.ProductImageUpdateInput = {};
    if (meta.color !== undefined) data.color = meta.color;
    if (meta.altTextHe !== undefined) data.altTextHe = meta.altTextHe;
    if (meta.altTextEn !== undefined) data.altTextEn = meta.altTextEn;

    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data,
      include: { upload: true },
    });
    return this.resolveImageUrl(updated);
  }

  /** Sets the gallery order; `imageIds` must list every image of the product exactly once. */
  async reorderImages(productId: string, imageIds: string[]) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    if (images.length === 0) {
      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new NotFoundException('Product not found');
    }

    const current = new Set(images.map((i) => i.id));
    const sameSet = imageIds.length === current.size && imageIds.every((id) => current.has(id));
    if (!sameSet) {
      throw fieldValidationException([
        {
          field: 'imageIds',
          code: 'mismatch',
          message: 'imageIds must contain every image of the product exactly once',
        },
      ]);
    }

    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    const ordered = await this.prisma.productImage.findMany({
      where: { productId },
      ...IMAGE_INCLUDE,
    });
    return ordered.map((img) => this.resolveImageUrl(img));
  }

  async deleteImage(imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
      include: { upload: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    // Remove DB rows first so the product never points at a missing file;
    // a leftover storage object is harmless and logged.
    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.upload) {
      await this.prisma.upload.delete({ where: { id: image.upload.id } });
      await this.removeKeys([image.upload.s3Key]);
    }

    return { deleted: true };
  }
}
