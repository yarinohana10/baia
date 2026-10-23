import { isPurchasable, variantAvailability } from '../src/common/stock';

const variant = { isActive: true, trackInventory: true, stockQuantity: 5 };
const product = { isActive: true, backSoon: false };

describe('isPurchasable', () => {
  it('allows an active variant of a visible product with enough stock', () => {
    expect(isPurchasable(variant, product, 5)).toBe(true);
  });

  it('refuses more than the tracked stock', () => {
    expect(isPurchasable(variant, product, 6)).toBe(false);
    expect(isPurchasable({ ...variant, stockQuantity: 0 }, product, 1)).toBe(false);
  });

  it('never runs out for unlimited variants', () => {
    expect(isPurchasable({ ...variant, trackInventory: false, stockQuantity: 0 }, product, 99)).toBe(true);
  });

  it('refuses Hidden and Back Soon products even with stock', () => {
    expect(isPurchasable(variant, { ...product, isActive: false }, 1)).toBe(false);
    expect(isPurchasable(variant, { ...product, backSoon: true }, 1)).toBe(false);
  });

  it('refuses inactive variants', () => {
    expect(isPurchasable({ ...variant, isActive: false }, product, 1)).toBe(false);
  });
});

describe('variantAvailability', () => {
  it('maps stock against the threshold', () => {
    expect(variantAvailability({ ...variant, stockQuantity: 6 }, product, 5)).toBe('in_stock');
    expect(variantAvailability({ ...variant, stockQuantity: 5 }, product, 5)).toBe('low_stock');
    expect(variantAvailability({ ...variant, stockQuantity: 0 }, product, 5)).toBe('sold_out');
  });

  it('treats unlimited variants as in stock', () => {
    expect(variantAvailability({ ...variant, trackInventory: false, stockQuantity: 0 }, product, 5)).toBe('in_stock');
  });

  it('lets Hidden and Back Soon override stock', () => {
    expect(variantAvailability(variant, { isActive: false, backSoon: true }, 5)).toBe('hidden');
    expect(variantAvailability(variant, { isActive: true, backSoon: true }, 5)).toBe('back_soon');
  });

  it('a threshold of 0 only warns when sold out', () => {
    expect(variantAvailability({ ...variant, stockQuantity: 1 }, product, 0)).toBe('in_stock');
  });
});
