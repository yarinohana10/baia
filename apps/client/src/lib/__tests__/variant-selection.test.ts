import { describe, expect, it } from 'vitest';
import {
  activeVariants,
  clampQuantity,
  defaultColor,
  displayPrice,
  distinctValues,
  galleryImagesFor,
  initialSelection,
  resolveSelection,
  resolveSize,
  selectionReducer,
  type VariantSelection,
} from '../catalog/variant-selection';
import type { Variant } from '../catalog/types';

const v = (color: string, size: string, stockQuantity: number, over: Partial<Variant> = {}): Variant => ({
  id: `${color}-${size}`,
  color,
  size,
  stockQuantity,
  priceOverride: null,
  salePrice: null,
  saleStart: null,
  saleEnd: null,
  ...over,
});

// Yellow: S 15, M sold out, L 2. Navy: S sold out, M 3.
const variants = [v('Yellow', 'S', 15), v('Yellow', 'M', 0), v('Yellow', 'L', 2), v('Navy', 'S', 0), v('Navy', 'M', 3)];
const state = (over: Partial<VariantSelection>): VariantSelection => ({
  color: 'Yellow',
  size: 'S',
  quantity: 1,
  addError: null,
  ...over,
});

describe('variant basics', () => {
  it('drops inactive variants', () => {
    expect(activeVariants({ variants: [v('A', 'S', 1), v('A', 'M', 1, { isActive: false })] }).map((x) => x.id)).toEqual([
      'A-S',
    ]);
  });

  it('lists distinct colours and sizes in first-seen order', () => {
    expect(distinctValues(variants, 'color')).toEqual(['Yellow', 'Navy']);
    expect(distinctValues(variants, 'size')).toEqual(['S', 'M', 'L']);
  });

  it('starts on the first colour in stock', () => {
    expect(defaultColor([v('Red', 'S', 0), v('Blue', 'S', 1)])).toBe('Blue');
    expect(defaultColor([v('Red', 'S', 0)])).toBe('Red');
    expect(defaultColor([])).toBe('');
  });
});

describe('resolveSize', () => {
  const yellow = variants.slice(0, 3);
  it('keeps an in-stock size', () => expect(resolveSize(yellow, 'L')).toBe('L'));
  it('moves off a sold-out size to the first in stock', () => expect(resolveSize(yellow, 'M')).toBe('S'));
  it('picks the first in stock when nothing is selected', () => expect(resolveSize(yellow, '')).toBe('S'));
  it('keeps a sold-out size when every size is sold out', () => {
    expect(resolveSize([v('X', 'S', 0), v('X', 'M', 0)], 'M')).toBe('M');
    expect(resolveSize([v('X', 'S', 0), v('X', 'M', 0)], 'XL')).toBe('S');
  });
  it('leaves the size alone when the colour has no variants', () => expect(resolveSize([], 'M')).toBe('M'));
});

describe('clampQuantity', () => {
  it('stays between 1 and the stock', () => {
    expect(clampQuantity(5, 3)).toBe(3);
    expect(clampQuantity(0, 3)).toBe(1);
    expect(clampQuantity(4, 0)).toBe(1);
  });
});

describe('selection', () => {
  it('starts on the first in-stock colour and size', () => {
    expect(initialSelection([v('Red', 'S', 0), ...variants])).toEqual(state({}));
  });

  it('resolves against live stock', () => {
    const live = [v('Yellow', 'S', 0), ...variants.slice(1)];
    const resolved = resolveSelection(state({ quantity: 5 }), live);
    expect(resolved).toMatchObject({ size: 'L', quantity: 2, maxQuantity: 2 });
    expect(resolved.variant?.id).toBe('Yellow-L');
    expect(resolved.sizeOptions.map((x) => x.size)).toEqual(['S', 'M', 'L']);
  });

  it('clamps the quantity when a colour keeps the size', () => {
    const next = selectionReducer(state({ size: 'M', color: 'Navy', quantity: 3 }), {
      type: 'selectColor',
      color: 'Yellow',
      variants: [...variants.slice(0, 1), v('Yellow', 'M', 2), ...variants.slice(2)],
    });
    expect(next).toEqual(state({ size: 'M', quantity: 2 }));
  });

  it('starts the quantity over when a colour forces another size', () => {
    expect(selectionReducer(state({ quantity: 5 }), { type: 'selectColor', color: 'Navy', variants })).toEqual(
      state({ color: 'Navy', size: 'M', quantity: 1 }),
    );
  });

  it('clamps the quantity to the picked size', () => {
    expect(selectionReducer(state({ quantity: 5 }), { type: 'selectSize', size: 'L', variants })).toEqual(
      state({ size: 'L', quantity: 2 }),
    );
  });

  it('steps the quantity within stock', () => {
    const at = (quantity: number, size = 'L') => state({ size, quantity });
    expect(selectionReducer(at(1), { type: 'changeQuantity', delta: 1, variants }).quantity).toBe(2);
    expect(selectionReducer(at(2), { type: 'changeQuantity', delta: 1, variants }).quantity).toBe(2);
    expect(selectionReducer(at(2), { type: 'changeQuantity', delta: -1, variants }).quantity).toBe(1);
    expect(selectionReducer(at(1), { type: 'changeQuantity', delta: -1, variants }).quantity).toBe(1);
  });

  it('keeps an add-to-bag error only while the same variant is selected', () => {
    const error = { key: 'outOfStock' };
    const failed = selectionReducer(state({}), { type: 'setAddError', error });
    expect(failed.addError).toBe(error);
    expect(selectionReducer(failed, { type: 'changeQuantity', delta: 1, variants }).addError).toBe(error);
    expect(selectionReducer(failed, { type: 'selectSize', size: 'S', variants }).addError).toBe(error);
    expect(selectionReducer(failed, { type: 'selectSize', size: 'L', variants }).addError).toBeNull();
    expect(selectionReducer(failed, { type: 'selectColor', color: 'Navy', variants }).addError).toBeNull();
  });
});

describe('displayPrice', () => {
  const priced = [v('A', 'S', 1, { priceOverride: '120' }), v('A', 'M', 1, { salePrice: '80' }), v('A', 'L', 1)];
  it("uses the selected variant's price", () => {
    expect(displayPrice(priced[0], priced, '100')).toEqual({ current: 120, original: null });
  });
  it('falls back to the lowest price on offer, then the base price', () => {
    expect(displayPrice(undefined, priced, '100')).toEqual({ current: 80, original: 100 });
    expect(displayPrice(undefined, [], '99.90')).toEqual({ current: 99.9, original: null });
  });
});

describe('galleryImagesFor', () => {
  const images = [
    { url: 'a', color: 'Red' },
    { id: 'b', url: 'b', color: null },
    { url: 'c', color: 'Blue' },
  ];
  it("shows the colour's images plus colour-less ones, with stable ids", () => {
    expect(galleryImagesFor(images, 'Red')).toEqual([
      { id: 'img-0', url: 'a', color: 'Red' },
      { id: 'b', url: 'b', color: null },
    ]);
  });
  it('falls back to every image when none match', () => {
    expect(galleryImagesFor([{ url: 'a', color: 'Red' }], 'Blue')).toEqual([{ id: 'img-0', url: 'a', color: 'Red' }]);
  });
});
