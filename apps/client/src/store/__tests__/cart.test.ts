import { describe, expect, it } from 'vitest';
import { canIncrease, cartSubtotal, decreasedQuantity, lineIssue, shippingFor, type CartItem } from '../cart';

function line(quantity: number, variant: Partial<CartItem['variant']> = {}, productActive = true): CartItem {
  return {
    id: 'line',
    quantity,
    variant: {
      id: 'v',
      color: 'Blue',
      size: 'M',
      sku: 'SKU',
      stockQuantity: 10,
      trackInventory: true,
      isActive: true,
      priceOverride: null,
      salePrice: null,
      saleStart: null,
      saleEnd: null,
      ...variant,
      product: { id: 'p', nameHe: 'גל', nameEn: 'Wave', slug: 'wave', basePrice: '89.90', isActive: productActive, images: [] },
    },
  };
}

describe('cart lines', () => {
  it('flags inactive and out-of-stock lines', () => {
    expect(lineIssue(line(1))).toBeNull();
    expect(lineIssue(line(1, { isActive: false }))).toEqual({ kind: 'unavailable' });
    expect(lineIssue(line(1, {}, false))).toEqual({ kind: 'unavailable' });
    expect(lineIssue(line(1, { stockQuantity: 0 }))).toEqual({ kind: 'outOfStock' });
    expect(lineIssue(line(5, { stockQuantity: 2 }))).toEqual({ kind: 'insufficient', available: 2 });
  });

  it('never flags unlimited-stock lines for stock', () => {
    expect(lineIssue(line(40, { stockQuantity: 0, trackInventory: false }))).toBeNull();
    expect(canIncrease(line(98, { stockQuantity: 0, trackInventory: false }))).toBe(true);
    expect(canIncrease(line(99, { stockQuantity: 0, trackInventory: false }))).toBe(false);
  });

  it('steps an over-stock line straight down to what is available', () => {
    expect(decreasedQuantity(line(5, { stockQuantity: 2 }))).toBe(2);
    expect(decreasedQuantity(line(3, { stockQuantity: 0 }))).toBe(0);
    expect(decreasedQuantity(line(3))).toBe(2);
  });

  it('computes subtotal and shipping from the site config', () => {
    const items = [line(2), line(1, { salePrice: '50', saleStart: null, saleEnd: null })];
    expect(cartSubtotal(items)).toBeCloseTo(229.8);
    expect(shippingFor(229.8, { cost: 25, freeThreshold: 300 })).toBe(25);
    expect(shippingFor(300, { cost: 25, freeThreshold: 300 })).toBe(0);
  });
});
