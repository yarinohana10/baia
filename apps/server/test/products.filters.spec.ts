import { Test } from '@nestjs/testing';
import {
  filterConditions,
  parseCatalogFilters,
  parseList,
  parsePrice,
  variantWhere,
  MAX_FILTER_VALUES,
} from '../src/products/catalog-filters';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { ProductImagesService } from '../src/products/product-images.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { createMockStorageService } from './helpers';
import { createProductsPrismaMock, ProductsPrismaMock } from './products.mocks';

describe('catalog filter parsing', () => {
  it('parses comma lists, trimming, de-duplicating and dropping empty/oversized values', () => {
    expect(parseList(' M, L ,,M ', 20)).toEqual(['M', 'L']);
    expect(parseList(['S,M', 'XL'], 20)).toEqual(['S', 'M', 'XL']);
    expect(parseList('', 20)).toBeUndefined();
    expect(parseList('x'.repeat(21), 20)).toBeUndefined();
    expect(parseList(undefined, 20)).toBeUndefined();
    const many = Array.from({ length: 40 }, (_, i) => `s${i}`).join(',');
    expect(parseList(many, 20)).toHaveLength(MAX_FILTER_VALUES);
  });

  it('accepts only non-negative finite prices', () => {
    expect(parsePrice('120')).toBe(120);
    expect(parsePrice('99.999')).toBe(100);
    expect(parsePrice('-5')).toBeUndefined();
    expect(parsePrice('abc')).toBeUndefined();
    expect(parsePrice('Infinity')).toBeUndefined();
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('99999999')).toBe(100_000);
  });

  it('builds a clean filter object and swaps an inverted price range', () => {
    expect(parseCatalogFilters({})).toEqual({});
    expect(
      parseCatalogFilters({ sizes: 'M,L', colors: 'Black', minPrice: '300', maxPrice: '100', inStock: 'true' }),
    ).toEqual({ sizes: ['M', 'L'], colors: ['Black'], minPrice: 100, maxPrice: 300, inStock: true });
    expect(parseCatalogFilters({ inStock: 'yes' })).toEqual({});
  });
});

describe('catalog filter conditions', () => {
  it('size filters require an active, in-stock variant (unlimited counts as in stock)', () => {
    expect(variantWhere({ sizes: ['M'] })).toEqual({
      variants: {
        some: {
          isActive: true,
          size: { in: ['M'] },
          OR: [{ trackInventory: false }, { stockQuantity: { gt: 0 } }],
        },
      },
    });
  });

  it('a color-only filter matches any active variant of that color', () => {
    expect(variantWhere({ colors: ['Red'] })).toEqual({
      variants: { some: { isActive: true, color: { in: ['Red'] } } },
    });
  });

  it('size and color together must match on one variant', () => {
    const where = variantWhere({ sizes: ['M'], colors: ['Red'] });
    expect(where?.variants).toEqual({
      some: expect.objectContaining({ size: { in: ['M'] }, color: { in: ['Red'] } }),
    });
  });

  it('no variant filter when nothing is selected', () => {
    expect(variantWhere({})).toBeNull();
    expect(variantWhere({ minPrice: 10 })).toBeNull();
  });

  it('SQL conditions use the effective price and the in-stock rule', () => {
    const sql = filterConditions({ sizes: ['M'], minPrice: 50, maxPrice: 200 })
      .map((c) => c.sql)
      .join(' AND ');
    expect(sql).toContain('v."trackInventory" = false OR v."stockQuantity" > 0');
    expect(sql).toContain('COALESCE(ep.min_price, p."basePrice") >= ?');
    expect(sql).toContain('COALESCE(ep.min_price, p."basePrice") <= ?');
  });
});

describe('ProductsService.findAll with filters', () => {
  let service: ProductsService;
  let prisma: ProductsPrismaMock;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    prisma = createProductsPrismaMock();
    queryRaw = jest.fn();
    (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw = queryRaw;
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        ProductImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('size/color filters without price stay in Prisma (newest order)', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    await service.findAll({ filters: { sizes: ['M'] } });
    expect(queryRaw).not.toHaveBeenCalled();
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.variants.some.size).toEqual({ in: ['M'] });
    expect(prisma.product.count.mock.calls[0][0].where).toEqual(where);
  });

  it('a price filter selects ids and the total in SQL', async () => {
    queryRaw.mockResolvedValueOnce([{ id: 'a' }]).mockResolvedValueOnce([{ count: 7 }]);
    prisma.product.findMany.mockResolvedValue([{ id: 'a', images: [] }]);
    const result = await service.findAll({ filters: { maxPrice: 100 }, page: 1, limit: 5 });
    const [idsSql, countSql] = queryRaw.mock.calls.map((c) => c[0].sql as string);
    expect(idsSql).toContain('ORDER BY p."createdAt" DESC');
    expect(idsSql).toContain('<= ?');
    expect(countSql).toContain('COUNT(*)');
    expect(result.total).toBe(7);
    expect(result.totalPages).toBe(2);
    expect(prisma.product.count).not.toHaveBeenCalled();
  });

  it('featured limits the listing to featured products, in Prisma and in SQL', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);
    await service.findAll({ featured: true });
    expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, isFeatured: true });

    queryRaw.mockResolvedValueOnce([]);
    await service.findAll({ featured: true, sort: 'price-asc' });
    expect(queryRaw.mock.calls[0][0].sql).toContain('p."isFeatured" = true');
  });
});

describe('ProductsController filter wiring', () => {
  const service = { findAll: jest.fn().mockResolvedValue({}) };
  const controller = new ProductsController(service as unknown as ProductsService, {} as ProductImagesService);

  it('passes parsed filters and whitelists the sort', () => {
    controller.findAll('cat', undefined, '1', '12', 'drop table', undefined, {
      sizes: 'M,L',
      colors: 'Black',
      minPrice: 'abc',
      maxPrice: '200',
      inStock: 'true',
    });
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat',
        sort: 'newest',
        filters: { sizes: ['M', 'L'], colors: ['Black'], maxPrice: 200, inStock: true },
        featured: false,
      }),
    );
  });

  it('featured=true asks for featured products only; any other value is ignored', () => {
    controller.findAll(undefined, undefined, '1', '12', 'newest', 'true', {});
    expect(service.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ featured: true }));
    controller.findAll(undefined, undefined, '1', '12', 'newest', 'yes', {});
    expect(service.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ featured: false }));
  });
});
