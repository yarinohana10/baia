import { describe, expect, it } from 'vitest';
import { listingHref, parseListingQuery } from '../catalog/query';
import { activeSalePrice, formatPrice, isNewProduct, sizesInStock, totalStock } from '../catalog/pricing';
import { suggestedCollections } from '../catalog/collections';

describe('listing query', () => {
  it('sanitises unknown sort / bad page values', () => {
    expect(parseListingQuery({ sort: 'evil', page: '-3' })).toEqual({ sort: 'newest', page: 1, type: undefined });
    expect(parseListingQuery({ sort: 'price-asc', page: '2', type: 'men-swim-shorts' })).toEqual({
      sort: 'price-asc',
      page: 2,
      type: 'men-swim-shorts',
    });
  });

  it('drops defaults from hrefs so the canonical URL stays clean', () => {
    expect(listingHref('/category/men', { sort: 'newest', page: 1 })).toBe('/category/men');
    expect(listingHref('/category/men', { sort: 'price-desc', page: 3, type: 'x' })).toBe(
      '/category/men?type=x&sort=price-desc&page=3',
    );
  });
});

describe('pricing helpers', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it('only counts sales inside their window', () => {
    const variants = [
      { salePrice: '80', saleStart: '2026-10-01', saleEnd: '2026-10-31' },
      { salePrice: '50', saleStart: '2026-11-01', saleEnd: null },
    ];
    expect(activeSalePrice(variants, now)).toBe(80);
    expect(activeSalePrice([{ salePrice: null }], now)).toBeNull();
  });

  it('flags new products for 30 days', () => {
    expect(isNewProduct('2026-10-01T00:00:00Z', now)).toBe(true);
    expect(isNewProduct('2026-08-01T00:00:00Z', now)).toBe(false);
    expect(isNewProduct(undefined, now)).toBe(false);
  });

  it('orders in-stock sizes naturally and sums stock', () => {
    const variants = [
      { size: 'XL', stockQuantity: 1 },
      { size: 'S', stockQuantity: 2 },
      { size: 'M', stockQuantity: 0 },
    ];
    expect(sizesInStock(variants)).toEqual(['S', 'XL']);
    expect(totalStock(variants)).toBe(3);
  });

  it('formats shekel prices without trailing .00', () => {
    expect(formatPrice(190)).toBe('₪190');
    expect(formatPrice(189.9)).toBe('₪189.90');
  });
});

describe('empty category suggestions', () => {
  it('excludes the current collection', () => {
    const all = [
      { label: 'Men', href: '/category/men' },
      { label: 'Women', href: '/category/women' },
      { label: 'Kids', href: '/category/children' },
    ];
    expect(suggestedCollections(all, '/category/women').map((s) => s.label)).toEqual(['Men', 'Kids']);
  });
});
