import { describe, expect, it } from 'vitest';
import {
  activeColors,
  autoSku,
  initialColorBlocks,
  newVariant,
  removeColor,
  renameColor,
  setSizeAvailable,
  sizesForColor,
  stockLevel,
  stockSummary,
  type Variant,
} from './stock-variants';
import { validateProduct } from './validate-product';
import { getStockSummary } from '../products/stock-summary';

const saved = (color: string, size: string, extra: Partial<Variant> = {}): Variant => ({
  ...newVariant('top', color, size),
  tempId: undefined,
  id: `${color}-${size}`,
  autoSku: false,
  stockQuantity: 3,
  ...extra,
});

describe('stock variants', () => {
  it('builds readable SKUs and hashes names that do not slugify', () => {
    expect(autoSku('Sea Top', 'Black', 'M')).toBe('sea-top-black-m');
    expect(autoSku('', 'שחור', 'M')).toMatch(/^sku-[a-z0-9]{1,4}-m$/);
  });

  it('summarises active sizes', () => {
    const variants = [saved('Black', 'S'), saved('Black', 'M', { stockQuantity: 0 }), saved('Red', 'S', { trackInventory: false }), saved('Red', 'M', { isActive: false })];
    expect(stockSummary(variants)).toEqual({ sizes: 3, units: 3, unlimited: 1, zero: 1 });
  });

  it('groups variants into color blocks', () => {
    expect(initialColorBlocks([saved('Black', 'S'), saved('black ', 'M'), saved('Red', 'S')])).toEqual([
      { key: 'c0', name: 'Black' },
      { key: 'c1', name: 'Red' },
    ]);
    expect(initialColorBlocks([])).toEqual([{ key: 'c0', name: '' }]);
  });

  it('lists the size set first, then the color’s own sizes', () => {
    expect(sizesForColor([saved('Black', 'XXL'), saved('Black', 'S'), saved('Red', '3XL')], 'black', ['S', 'M'])).toEqual(['S', 'M', 'XXL']);
  });

  it('adds new sizes and deactivates saved ones instead of dropping them', () => {
    const added = setSizeAvailable([saved('Black', 'S')], ' Black ', 'M', true, 'top');
    expect(added[1]).toMatchObject({ color: 'Black', size: 'M', sku: 'top-black-m', isActive: true });
    expect(setSizeAvailable(added, 'Black', 'M', false, 'top')).toHaveLength(1);
    expect(setSizeAvailable(added, 'Black', 'S', false, 'top')[0].isActive).toBe(false);
  });

  it('renames and removes colors', () => {
    const generated = newVariant('top', 'Black', 'M');
    const renamed = renameColor([saved('Black', 'S'), generated], 'Black', 'Navy', 'top');
    expect(renamed.map((v) => [v.color, v.sku])).toEqual([
      ['Navy', saved('Black', 'S').sku],
      ['Navy', 'top-navy-m'],
    ]);
    expect(removeColor([saved('Black', 'S'), generated, saved('Red', 'S')], 'black')).toEqual([
      { ...saved('Black', 'S'), isActive: false },
      saved('Red', 'S'),
    ]);
  });

  it('reads stock levels and active colors', () => {
    expect(stockLevel(undefined)).toBe('off');
    expect(stockLevel(saved('A', 'S', { stockQuantity: 0 }))).toBe('soldOut');
    expect(stockLevel(saved('A', 'S', { stockQuantity: 5 }))).toBe('low');
    expect(stockLevel(saved('A', 'S', { stockQuantity: 6 }))).toBe('ok');
    expect(activeColors([saved(' Black ', 'S'), saved('Black', 'M'), saved('Red', 'S', { isActive: false })])).toEqual(['Black']);
  });
});

describe('validateProduct', () => {
  const t = (key: string) => key;
  const base = { nameHe: 'א', nameEn: 'A', slug: 'a', basePrice: '100', categoryId: 'c', isActive: true };

  it('requires the basics and at least one size for a visible product', () => {
    expect(validateProduct({ ...base, nameEn: ' ', slug: 'Bad Slug', basePrice: '0', categoryId: '', variants: [] }, t)).toEqual({
      nameEn: 'validation.nameEnRequired',
      slug: 'errors.slugInvalid',
      basePrice: 'validation.pricePositive',
      categoryId: 'validation.categoryRequired',
      variants: 'errors.noSizes',
    });
  });

  it('checks each variant', () => {
    const variants = [
      saved('Black', 'S', { sku: 'X' }),
      saved('black', 'S', { id: 'other', sku: 'x', salePrice: '150', saleStart: '2026-02-01', saleEnd: '2026-01-01' }),
    ];
    expect(validateProduct({ ...base, variants }, t)).toEqual({
      'variants.1.sku': 'errors.skuDuplicate',
      'variants.1.size': 'errors.variantDuplicate',
      'variants.1.salePrice': 'errors.saleBelowPrice',
      'variants.1.saleEnd': 'errors.saleDateRange',
    });
  });
});

describe('getStockSummary (products list)', () => {
  it('rates stock from tracked active sizes', () => {
    expect(getStockSummary([]).status).toBe('no_sizes');
    expect(getStockSummary([{ id: '1', isActive: true, stockQuantity: 0 }]).status).toBe('out_of_stock');
    expect(getStockSummary([{ id: '1', isActive: true, stockQuantity: 0, trackInventory: false }]).status).toBe('in_stock');
    expect(getStockSummary([{ id: '1', isActive: true, stockQuantity: 4 }, { id: '2', isActive: true, stockQuantity: 40 }])).toEqual({
      status: 'low_stock',
      sizes: 2,
      tracked: 44,
      trackedCount: 2,
      unlimitedCount: 0,
    });
  });
});
