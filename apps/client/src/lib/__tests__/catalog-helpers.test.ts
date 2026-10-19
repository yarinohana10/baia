import { describe, expect, it } from 'vitest';
import { LIGHTBOX_CLOSED, lightboxReducer } from '../catalog/lightbox';
import { categoryLinks, localizedName } from '../catalog/names';
import { isLightColor, sizesInStock } from '../catalog/pricing';

describe('localizedName / categoryLinks', () => {
  const swim = { nameHe: 'בגדי ים', nameEn: 'Swimwear', slug: 'swim' };
  it('picks the name for the locale', () => {
    expect(localizedName(swim, 'he')).toBe('בגדי ים');
    expect(localizedName(swim, 'en')).toBe('Swimwear');
  });
  it('builds category links', () => {
    expect(categoryLinks([swim], 'en')).toEqual([{ label: 'Swimwear', href: '/category/swim' }]);
  });
});

describe('lightboxReducer', () => {
  it('opens at an image, unzoomed', () => {
    expect(lightboxReducer({ isOpen: false, index: 3, zoomed: true }, { type: 'open', index: 1 })).toEqual({
      isOpen: true,
      index: 1,
      zoomed: false,
    });
  });
  it('wraps around when stepping and zooms back out', () => {
    const open = { isOpen: true, index: 0, zoomed: true };
    expect(lightboxReducer(open, { type: 'step', delta: -1, count: 3 })).toEqual({ isOpen: true, index: 2, zoomed: false });
    expect(lightboxReducer({ ...open, index: 2 }, { type: 'step', delta: 1, count: 3 }).index).toBe(0);
    expect(lightboxReducer(open, { type: 'show', index: 1 })).toEqual({ isOpen: true, index: 1, zoomed: false });
  });
  it('toggles zoom and keeps the image when closing', () => {
    const open = { isOpen: true, index: 2, zoomed: false };
    expect(lightboxReducer(open, { type: 'toggleZoom' }).zoomed).toBe(true);
    expect(lightboxReducer(open, { type: 'close' })).toEqual({ ...open, isOpen: false });
    expect(LIGHTBOX_CLOSED.isOpen).toBe(false);
  });
});

describe('pricing helpers', () => {
  it('tells light swatches from dark ones', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
    expect(isLightColor('#F3E9D2')).toBe(true);
    expect(isLightColor('#1C1C1C')).toBe(false);
  });
  it('lists in-stock sizes once, in size order', () => {
    const v = (size: string, stockQuantity: number) => ({
      size,
      stockQuantity,
      color: 'A',
      priceOverride: null,
      salePrice: null,
      saleStart: null,
      saleEnd: null,
    });
    expect(sizesInStock([v('L', 1), v('S', 2), v('M', 0), v('S', 1), v('XS', 3)])).toEqual(['XS', 'S', 'L']);
  });
});
