import { Injectable, NotFoundException, Inject, Logger, Optional } from '@nestjs/common';
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
import { availableStock, variantAvailability, type Availability } from '../common/stock';
import { StockAlertsService } from '../inventory/stock-alerts.service';
import {
  CatalogFilters,
  EFFECTIVE_PRICE_JOIN,
  EFFECTIVE_PRICE_SQL,
  filterConditions,
  hasPriceFilter,
  IN_STOCK_SQL,
  ListingScope,
  scopeConditions,
  variantWhere,
} from './catalog-filters';

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

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const IMAGE_INCLUDE = { orderBy: { sortOrder: 'asc' }, include: { upload: true } } as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Optional() private stockAlerts?: StockAlertsService,
  ) {}

  /** SiteConfig.lowStockThreshold; the catalog must keep working if it can't be read. */
  private async lowStockThreshold(): Promise<number> {
    try {
      const config = await this.prisma.siteConfig.findUnique({
        where: { id: 'default' },
        select: { lowStockThreshold: true },
      });
      return config?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    } catch {
      return DEFAULT_LOW_STOCK_THRESHOLD;
    }
  }

  /**
   * Adds the computed `availability` to a product and each of its variants
   * (in_stock | low_stock | sold_out | back_soon | hidden). The product is
   * back_soon when an Admin set it or every purchasable size is sold out
   * (shown to customers as Back Soon too, but kept apart for the admin).
   */
  private withAvailability<
    T extends {
      isActive: boolean;
      backSoon: boolean;
      variants?: { isActive: boolean; trackInventory: boolean; stockQuantity: number }[];
    },
  >(product: T, threshold: number): T & { availability: Availability; variants: (NonNullable<T['variants']>[number] & { availability: Availability })[] } {
    const variants = (product.variants ?? []).map((v) => ({
      ...v,
      availability: variantAvailability(v, product, threshold),
    }));
    const live = variants.filter((v) => v.isActive);
    let availability: Availability;
    if (!product.isActive) availability = 'hidden';
    else if (product.backSoon) availability = 'back_soon';
    else if (live.length === 0 || live.every((v) => v.availability === 'sold_out')) availability = 'sold_out';
    else if (live.some((v) => v.availability === 'in_stock')) availability = 'in_stock';
    else availability = 'low_stock';
    return { ...product, availability, variants } as never;
  }

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

  /** Category plus its direct children (listings include subcategory products). */
  private async categoryScope(categoryId?: string): Promise<string[] | null> {
    if (!categoryId) return null;
    const childCategories = await this.prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });
    return [categoryId, ...childCategories.map((c) => c.id)];
  }

  async findAll(params?: {
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
    filters?: CatalogFilters;
  }) {
    const { categoryId, search, sort = 'newest', filters = {} } = params || {};
    const page = Math.max(1, Math.trunc(params?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(params?.limit ?? 20) || 20));

    const where: Prisma.ProductWhereInput = { isActive: true };
    const categoryIds = await this.categoryScope(categoryId);
    if (categoryIds) {
      where.categoryId = categoryIds.length > 1 ? { in: categoryIds } : categoryId;
    }

    if (search) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameHe: { contains: search, mode: 'insensitive' } },
      ];
    }
    const variantFilter = variantWhere(filters);
    if (variantFilter) Object.assign(where, variantFilter);

    const include = {
      category: true,
      variants: { where: { isActive: true } },
      images: IMAGE_INCLUDE,
    } as const;
    const skip = (page - 1) * limit;
    const priceSort = sort === 'price-asc' || sort === 'price-desc';
    const priceFilter = hasPriceFilter(filters);

    let products;
    let total: number;
    if (priceSort || priceFilter) {
      // Effective prices (live sale price, else override, else base) are only
      // known in SQL, so ids, order and count come from a raw query and the
      // rows are then loaded with Prisma in that order.
      const scope = { categoryIds, search };
      const ids = await this.filteredIds({
        scope,
        filters,
        order: priceSort ? (sort === 'price-asc' ? 'price-asc' : 'price-desc') : 'newest',
        skip,
        limit,
      });
      const rows = ids.length
        ? await this.prisma.product.findMany({ where: { id: { in: ids } }, include })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      products = ids.map((id) => byId.get(id)).filter((p): p is (typeof rows)[number] => !!p);
      total = priceFilter ? await this.filteredCount(scope, filters) : await this.prisma.product.count({ where });
    } else {
      products = await this.prisma.product.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      });
      total = await this.prisma.product.count({ where });
    }

    const threshold = await this.lowStockThreshold();
    return {
      products: products.map((p) => this.withAvailability(this.resolveProductImages(p), threshold)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Active product ids for a listing, filtered and ordered in SQL. */
  private async filteredIds(params: {
    scope: ListingScope;
    filters: CatalogFilters;
    order: 'newest' | 'price-asc' | 'price-desc';
    skip: number;
    limit: number;
  }): Promise<string[]> {
    const conditions = [...scopeConditions(params.scope), ...filterConditions(params.filters)];
    const orderBy =
      params.order === 'newest'
        ? Prisma.sql`p."createdAt" DESC, p.id`
        : Prisma.sql`${EFFECTIVE_PRICE_SQL} ${Prisma.raw(params.order === 'price-asc' ? 'ASC' : 'DESC')}, p."createdAt" DESC, p.id`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id
      FROM products p
      ${EFFECTIVE_PRICE_JOIN}
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${params.limit} OFFSET ${params.skip}
    `);
    return rows.map((r) => r.id);
  }

  private async filteredCount(scope: ListingScope, filters: CatalogFilters): Promise<number> {
    const conditions = [...scopeConditions(scope), ...filterConditions(filters)];
    const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM products p
      ${EFFECTIVE_PRICE_JOIN}
      WHERE ${Prisma.join(conditions, ' AND ')}
    `);
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Filter options for a listing scope (category incl. children, search):
   * - sizes: only sizes in stock right now, in size-set order, with the number
   *   of products offering each
   * - colors: colors of active variants with product counts
   * - price: min/max effective price
   * Facets ignore the shopper's current filters, so options never disappear
   * while filtering.
   */
  async facets(params: { categoryId?: string; search?: string }) {
    const scope: ListingScope = { categoryIds: await this.categoryScope(params.categoryId), search: params.search };
    const where = Prisma.join(scopeConditions(scope), ' AND ');

    const [sizeRows, colorRows, priceRows, sizeSets] = await Promise.all([
      this.prisma.$queryRaw<{ value: string; count: number }[]>(Prisma.sql`
        SELECT v.size AS value, COUNT(DISTINCT p.id)::int AS count
        FROM products p
        JOIN product_variants v ON v."productId" = p.id
        WHERE ${where} AND v."isActive" = true AND ${IN_STOCK_SQL}
        GROUP BY v.size
      `),
      this.prisma.$queryRaw<{ value: string; count: number }[]>(Prisma.sql`
        SELECT v.color AS value, COUNT(DISTINCT p.id)::int AS count
        FROM products p
        JOIN product_variants v ON v."productId" = p.id
        WHERE ${where} AND v."isActive" = true
        GROUP BY v.color
      `),
      this.prisma.$queryRaw<{ min: unknown; max: unknown }[]>(Prisma.sql`
        SELECT MIN(${EFFECTIVE_PRICE_SQL}) AS min, MAX(${EFFECTIVE_PRICE_SQL}) AS max
        FROM products p
        ${EFFECTIVE_PRICE_JOIN}
        WHERE ${where}
      `),
      this.prisma.sizeSet.findMany({ orderBy: { sortOrder: 'asc' }, select: { sizes: true } }),
    ]);

    const order = [...new Set(sizeSets.flatMap((s) => s.sizes))];
    const price = priceRows[0];
    const asNumber = (v: unknown) => (v === null || v === undefined ? null : toNumber(v as DecimalLike));
    return {
      sizes: sizeRows
        .map((r) => ({ value: r.value, count: Number(r.count) }))
        .sort((a, b) => compareSizes(a.value, b.value, order)),
      colors: colorRows
        .map((r) => ({ value: r.value, count: Number(r.count) }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      price: { min: asNumber(price?.min), max: asNumber(price?.max) },
    };
  }

  /**
   * "You may also like": active products from the same category first, then
   * from sibling categories under the same parent; in-stock before sold-out,
   * newest first within each group.
   */
  async related(slug: string, limit = 8) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, isActive: true, categoryId: true, category: { select: { parentId: true } } },
    });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');

    const parentId = product.category?.parentId ?? null;
    const siblingIds = parentId
      ? (await this.prisma.category.findMany({ where: { parentId }, select: { id: true } })).map((c) => c.id)
      : [];
    const categoryIds = [...new Set([product.categoryId, ...siblingIds, ...(parentId ? [parentId] : [])])];

    const candidates = await this.prisma.product.findMany({
      where: { isActive: true, id: { not: product.id }, categoryId: { in: categoryIds } },
      include: { variants: { where: { isActive: true } }, images: IMAGE_INCLUDE },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 60,
    });

    const rank = (p: (typeof candidates)[number]) => ({
      sameCategory: p.categoryId === product.categoryId ? 0 : 1,
      soldOut: !p.backSoon && p.variants.some((v) => availableStock(v) > 0) ? 0 : 1,
    });
    const threshold = await this.lowStockThreshold();
    return candidates
      .map((p, index) => ({ p, index, r: rank(p) }))
      .sort((a, b) => a.r.sameCategory - b.r.sameCategory || a.r.soldOut - b.r.soldOut || a.index - b.index)
      .slice(0, limit)
      .map(({ p }) => this.withAvailability(this.resolveProductImages(p), threshold));
  }

  private adminWhere(params?: { search?: string; categoryId?: string }) {
    const where: Prisma.ProductWhereInput = {};
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.search) {
      where.OR = [
        { nameEn: { contains: params.search, mode: 'insensitive' } },
        { nameHe: { contains: params.search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: params.search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private readonly adminInclude = {
    category: true,
    variants: true,
    images: IMAGE_INCLUDE,
    _count: { select: { variants: true } },
  } as const;

  /** Every product as a plain array (legacy shape used by the admin products page). */
  async findAllAdmin(params?: { search?: string; categoryId?: string }) {
    const products = await this.prisma.product.findMany({
      where: this.adminWhere(params),
      include: this.adminInclude,
      orderBy: { createdAt: 'desc' },
    });

    const threshold = await this.lowStockThreshold();
    return products.map((p) => this.withAvailability(this.resolveProductImages(p), threshold));
  }

  /** Paginated admin list: `{ products, total, page, limit, totalPages }`. */
  async findAllAdminPage(params: { search?: string; categoryId?: string; page: number; limit: number }) {
    const where = this.adminWhere(params);
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: this.adminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const threshold = await this.lowStockThreshold();
    return {
      products: products.map((p) => this.withAvailability(this.resolveProductImages(p), threshold)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
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
    return this.withAvailability(this.resolveProductImages(this.sortVariantsBySize(product)), await this.lowStockThreshold());
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
    return this.withAvailability(this.resolveProductImages(this.sortVariantsBySize(product)), await this.lowStockThreshold());
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
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
        include: { _count: { select: { children: true } } },
      });
      if (!category) {
        errors.push({ field: 'categoryId', code: 'notFound', message: 'Category does not exist' });
      } else if ((category._count?.children ?? 0) > 0) {
        // Products live in leaf categories (e.g. Men › Swim Shorts); the parent
        // listing already includes its subcategories' products.
        errors.push({
          field: 'categoryId',
          code: 'hasSubcategories',
          message: 'Choose a subcategory; this category has subcategories',
        });
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
    // With expectedStockQuantity the edit is applied as a delta (see editStock).
    if (v.stockQuantity !== undefined && v.expectedStockQuantity === undefined) data.stockQuantity = v.stockQuantity;
    if (v.trackInventory !== undefined) data.trackInventory = v.trackInventory;
    if (v.priceOverride !== undefined) data.priceOverride = decimalOrNull(v.priceOverride);
    if (v.salePrice !== undefined) data.salePrice = decimalOrNull(v.salePrice);
    if (v.saleStart !== undefined) data.saleStart = dateOrNull(v.saleStart);
    if (v.saleEnd !== undefined) data.saleEnd = dateOrNull(v.saleEnd);
    if (v.isActive !== undefined) data.isActive = v.isActive;
    return data;
  }

  /**
   * Applies an admin stock edit made against the quantity the form loaded:
   * stock moves by (new - expected) in one atomic UPDATE, so units sold or
   * restocked since the form was opened are kept. Removing more than is left
   * is refused (409) instead of going negative. Returns whether stock changed.
   */
  private async editStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    v: { stockQuantity?: number; expectedStockQuantity?: number },
    field: string,
  ): Promise<boolean> {
    if (v.stockQuantity === undefined || v.expectedStockQuantity === undefined) return false;
    const delta = v.stockQuantity - v.expectedStockQuantity;
    if (delta === 0) return false;
    const result = await tx.productVariant.updateMany({
      where: { id: variantId, ...(delta < 0 ? { stockQuantity: { gte: -delta } } : {}) },
      data: { stockQuantity: { increment: delta } },
    });
    if (result.count !== 1) {
      throw fieldConflictException([
        {
          field,
          code: 'stockChanged',
          message: 'Stock changed since the form was opened (items were sold); reload and edit again',
        },
      ]);
    }
    return true;
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
    if ((dto.isActive ?? true) && variants.filter((v) => v.isActive ?? true).length === 0) {
      // A visible product with no sizes would show as "out of stock" in the store.
      errors.push({ field: 'variants', code: 'required', message: 'Add at least one size with stock, or save the product as hidden' });
    }
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
            fabricHe: dto.fabricHe ?? null,
            fabricEn: dto.fabricEn ?? null,
            careHe: dto.careHe ?? null,
            careEn: dto.careEn ?? null,
            fitHe: dto.fitHe ?? null,
            fitEn: dto.fitEn ?? null,
            slug: dto.slug,
            basePrice: new Prisma.Decimal(dto.basePrice),
            categoryId: dto.categoryId,
            sizeSetId: dto.sizeSetId ?? null,
            isFeatured: dto.isFeatured ?? false,
            isActive: dto.isActive ?? true,
            backSoon: dto.backSoon ?? false,
            variants: {
              create: variants.map((v) => ({
                color: v.color,
                size: v.size,
                sku: v.sku,
                stockQuantity: v.stockQuantity,
                trackInventory: v.trackInventory ?? true,
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
      include: { variants: { select: { id: true, isActive: true, trackInventory: true } } },
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
    // Same rule as create: a visible product needs at least one active size.
    // Checked when visibility or sizes change (e.g. "show in store" from the list).
    if (dto.isActive === true || (dto.variants && (dto.isActive ?? existing.isActive))) {
      const active = new Map(existing.variants.map((v) => [v.id, v.isActive]));
      variants.forEach((v, i) => {
        if (v.id) active.set(v.id, v.isActive ?? active.get(v.id) ?? true);
        else active.set(`new-${i}`, v.isActive ?? true);
      });
      if (![...active.values()].some(Boolean)) {
        errors.push({ field: 'variants', code: 'required', message: 'Add at least one size with stock, or save the product as hidden' });
      }
    }
    if (errors.length) throw fieldValidationException(errors);

    const conflicts = await this.uniquenessErrors({ slug: dto.slug, excludeProductId: id, variants });
    if (conflicts.length) throw fieldConflictException(conflicts);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    const scalarKeys = [
      'nameHe', 'nameEn', 'descriptionHe', 'descriptionEn', 'slug',
      'categoryId', 'isFeatured', 'isActive', 'backSoon', 'sizeSetId',
      'fabricHe', 'fabricEn', 'careHe', 'careEn', 'fitHe', 'fitEn',
    ] as const;
    for (const key of scalarKeys) {
      if (dto[key] !== undefined) (data as Record<string, unknown>)[key] = dto[key];
    }
    if (dto.basePrice !== undefined) data.basePrice = new Prisma.Decimal(dto.basePrice);

    const stockTouched: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      for (const [i, v] of variants.entries()) {
        if (v.id) {
          const tracked = v.trackInventory ?? existing.variants.find((e) => e.id === v.id)?.trackInventory ?? true;
          await tx.productVariant.update({ where: { id: v.id }, data: this.variantData(v) });
          // Unlimited variants ignore quantity edits.
          if (tracked) await this.editStock(tx, v.id, v, `variants.${i}.stockQuantity`);
          if (v.stockQuantity !== undefined || v.trackInventory !== undefined) stockTouched.push(v.id);
        } else {
          await tx.productVariant.create({
            data: { ...(this.variantData(v) as Prisma.ProductVariantUncheckedCreateInput), productId: id },
          });
        }
      }
    });
    void this.stockAlerts?.notifyAfterStockChange(stockTouched);

    return this.findById(id);
  }

  /**
   * Deletes a product, or archives it when any of its variants has been
   * ordered (order_items reference variants, so the rows must stay):
   * - ordered   -> product and variants set `isActive=false`, returns `{ archived: true }`
   * - otherwise -> DB rows deleted first, then storage objects, returns `{ deleted: true }`
   */
  async delete(id: string): Promise<{ deleted: true } | { archived: true }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { include: { upload: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const ordered = await this.prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (ordered > 0) {
      await this.prisma.$transaction([
        this.prisma.product.update({ where: { id }, data: { isActive: false } }),
        this.prisma.productVariant.updateMany({ where: { productId: id }, data: { isActive: false } }),
      ]);
      return { archived: true };
    }

    const uploads = product.images.flatMap((image) => (image.upload ? [image.upload] : []));
    await this.prisma.$transaction([
      // Cart lines reference variants without ON DELETE CASCADE.
      this.prisma.cartItem.deleteMany({ where: { variant: { productId: id } } }),
      // Images and variants cascade with the product.
      this.prisma.product.delete({ where: { id } }),
      this.prisma.upload.deleteMany({ where: { id: { in: uploads.map((u) => u.id) } } }),
    ]);

    // Storage last: a failure here only leaves an orphaned object, never a broken product.
    await this.removeKeys(uploads.map((u) => u.s3Key));
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

    const tracked = dto.trackInventory ?? variant.trackInventory;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.productVariant.update({ where: { id: variantId }, data: this.variantData(dto) });
      if (!tracked || !(await this.editStock(tx, variantId, dto, 'stockQuantity'))) return row;
      return tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    });
    if (dto.stockQuantity !== undefined || dto.trackInventory !== undefined) {
      void this.stockAlerts?.notifyAfterStockChange([variantId]);
    }
    return updated;
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
