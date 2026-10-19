import { describe, expect, it } from 'vitest';
import {
  activeFilterChips,
  filterAvailability,
  hasPriceRange,
  isPriceFiltered,
  parsePriceInput,
  priceInputValue,
  priceRangeFromInputs,
  withSelectedOptions,
} from '../catalog/filter-options';
import type { Facets } from '../catalog/types';

const facets = (over: Partial<Facets> = {}): Facets => ({
  sizes: [],
  colors: [],
  price: { min: null, max: null },
  ...over,
});

describe('filter availability', () => {
  it('needs a real price range', () => {
    expect(hasPriceRange(facets({ price: { min: 100, max: 200 } }))).toBe(true);
    expect(hasPriceRange(facets({ price: { min: 100, max: 100 } }))).toBe(false);
    expect(hasPriceRange(facets({ price: { min: null, max: 200 } }))).toBe(false);
  });

  it('shows a control when facets offer it or the shopper already uses it', () => {
    expect(filterAvailability(facets(), {})).toEqual({ sizes: false, colors: false, price: false });
    expect(
      filterAvailability(facets({ sizes: [{ value: 'M', count: 2 }], price: { min: 50, max: 90 } }), {}),
    ).toEqual({ sizes: true, colors: false, price: true });
    expect(filterAvailability(facets(), { sizes: ['M'], colors: ['Red'], maxPrice: 100 })).toEqual({
      sizes: true,
      colors: true,
      price: true,
    });
  });

  it('detects a price filter from either bound', () => {
    expect(isPriceFiltered({})).toBe(false);
    expect(isPriceFiltered({ minPrice: 0 })).toBe(true);
    expect(isPriceFiltered({ maxPrice: 10 })).toBe(true);
  });
});

describe('withSelectedOptions', () => {
  it('appends selected values the facets no longer offer, once, with count 0', () => {
    const options = [
      { value: 'S', count: 3 },
      { value: 'M', count: 1 },
    ];
    expect(withSelectedOptions(options, ['M', 'XL'])).toEqual([...options, { value: 'XL', count: 0 }]);
    expect(withSelectedOptions(options, [])).toEqual(options);
    expect(withSelectedOptions([], ['L'])).toEqual([{ value: 'L', count: 0 }]);
  });
});

describe('price inputs', () => {
  it('parses whole, non-negative amounts and treats anything else as no bound', () => {
    expect(parsePriceInput('120')).toBe(120);
    expect(parsePriceInput('99.6')).toBe(100);
    expect(parsePriceInput('0')).toBe(0);
    expect(parsePriceInput('')).toBeUndefined();
    expect(parsePriceInput('  ')).toBeUndefined();
    expect(parsePriceInput('-5')).toBeUndefined();
    expect(parsePriceInput('abc')).toBeUndefined();
  });

  it('swaps a reversed range and keeps open ends', () => {
    expect(priceRangeFromInputs('300', '100')).toEqual({ min: 100, max: 300 });
    expect(priceRangeFromInputs('100', '')).toEqual({ min: 100, max: undefined });
    expect(priceRangeFromInputs('', '')).toEqual({ min: undefined, max: undefined });
  });

  it('renders an optional bound as input text', () => {
    expect(priceInputValue(undefined)).toBe('');
    expect(priceInputValue(0)).toBe('0');
    expect(priceInputValue(150)).toBe('150');
  });
});

describe('activeFilterChips', () => {
  it('lists sizes, colours, price and stock in order, each with its removal patch', () => {
    expect(
      activeFilterChips({ sizes: ['S', 'M'], colors: ['Red'], minPrice: 50, inStock: true }),
    ).toEqual([
      { key: 's-S', kind: 'size', value: 'S', remove: { sizes: ['M'] } },
      { key: 's-M', kind: 'size', value: 'M', remove: { sizes: ['S'] } },
      { key: 'c-Red', kind: 'color', value: 'Red', remove: { colors: undefined } },
      { key: 'price', kind: 'price', min: 50, max: undefined, remove: { minPrice: undefined, maxPrice: undefined } },
      { key: 'stock', kind: 'inStock', remove: { inStock: undefined } },
    ]);
  });

  it('is empty without filters', () => {
    expect(activeFilterChips({})).toEqual([]);
  });
});
