import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  clearFilters,
  filterApiParams,
  listingHref,
  parseListingQuery,
  toggleValue,
  withFilters,
} from '../catalog/query';
import { discountPercent, lowStockCount, variantPrice } from '../catalog/pricing';

describe('listing filters <-> URL', () => {
  it('parses filters from search params', () => {
    const q = parseListingQuery({
      sizes: 'M, L,,M',
      colors: ['Black', 'Red'],
      minPrice: '100',
      maxPrice: '250.6',
      inStock: '1',
      sort: 'price-asc',
    });
    expect(q).toMatchObject({
      sort: 'price-asc',
      page: 1,
      sizes: ['M', 'L'],
      colors: ['Black', 'Red'],
      minPrice: 100,
      maxPrice: 251,
      inStock: true,
    });
  });

  it('ignores junk and swaps an inverted price range', () => {
    const q = parseListingQuery({ minPrice: '-3', maxPrice: 'abc', inStock: 'yes', sizes: '' });
    expect(q).toEqual({ sort: 'newest', page: 1, type: undefined, q: undefined });
    expect(parseListingQuery({ minPrice: '300', maxPrice: '100' })).toMatchObject({ minPrice: 100, maxPrice: 300 });
  });

  it('round-trips through listingHref', () => {
    const q = parseListingQuery({ type: 'bikini', sizes: 'S,M', colors: 'Navy', maxPrice: '200', inStock: 'true', page: '2' });
    const href = listingHref('/category/women', q);
    expect(href).toBe('/category/women?type=bikini&sizes=S%2CM&colors=Navy&maxPrice=200&inStock=1&page=2');
    const back = parseListingQuery(Object.fromEntries(new URLSearchParams(href.split('?')[1])));
    expect(back).toEqual(q);
  });

  it('keeps canonical URLs clean when nothing is filtered', () => {
    expect(listingHref('/new-arrivals', parseListingQuery({}))).toBe('/new-arrivals');
  });

  it('any filter change goes back to page 1 and drops empty values', () => {
    const q = parseListingQuery({ sizes: 'M', page: '4', sort: 'price-desc', q: 'bikini' });
    const next = withFilters(q, { sizes: toggleValue(q.sizes, 'M'), inStock: true });
    expect(next).toEqual({ sort: 'price-desc', page: 1, q: 'bikini', type: undefined, inStock: true });
    expect(listingHref('/search', next)).toBe('/search?q=bikini&inStock=1&sort=price-desc');
  });

  it('toggles multi-select values', () => {
    expect(toggleValue(undefined, 'M')).toEqual(['M']);
    expect(toggleValue(['M', 'L'], 'M')).toEqual(['L']);
    expect(toggleValue(['M'], 'M')).toBeUndefined();
  });

  it('clears filters but keeps sort, search and sub-category', () => {
    const q = parseListingQuery({ type: 'x', q: 'top', sort: 'price-asc', sizes: 'M', colors: 'Red', minPrice: '5', inStock: '1', page: '3' });
    expect(activeFilterCount(q)).toBe(4);
    const cleared = clearFilters(q);
    expect(activeFilterCount(cleared)).toBe(0);
    expect(listingHref('/search', cleared)).toBe('/search?q=top&type=x&sort=price-asc');
  });

  it('maps filters to API params', () => {
    expect(filterApiParams({ sizes: ['M', 'L'], colors: ['Red'], minPrice: 0, maxPrice: 99, inStock: true })).toEqual({
      sizes: 'M,L',
      colors: 'Red',
      minPrice: '0',
      maxPrice: '99',
      inStock: 'true',
    });
    expect(filterApiParams({})).toEqual({});
  });
});

describe('PDP pricing helpers', () => {
  it('uses a live sale over the override / base price', () => {
    const v = { priceOverride: '180', salePrice: '120', saleStart: null, saleEnd: null };
    expect(variantPrice(v, '200')).toEqual({ current: 120, original: 180 });
    expect(variantPrice({ ...v, saleEnd: '2000-01-01' }, '200')).toEqual({ current: 180, original: null });
    expect(discountPercent(120, 180)).toBe(33);
    expect(discountPercent(120, null)).toBe(0);
  });

  it('shows "only N left" up to the configured threshold, tracked stock only', () => {
    expect(lowStockCount({ stockQuantity: 3 }, 3)).toBe(3);
    expect(lowStockCount({ stockQuantity: 4 }, 3)).toBeNull();
    expect(lowStockCount({ stockQuantity: 1, trackInventory: false }, 3)).toBeNull();
  });
});
