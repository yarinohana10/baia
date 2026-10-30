import { describe, expect, it } from 'vitest';
import { localized, shopCategoryFor, sizeGuideForCategory, type SizeGuide } from '../catalog/size-guides';

const guide = (id: string, categories: SizeGuide['categories'] = []): SizeGuide => ({
  id,
  slug: id,
  nameHe: id,
  nameEn: id,
  introHe: null,
  introEn: null,
  imageUrl: null,
  imageAltHe: null,
  imageAltEn: null,
  tables: [],
  steps: [],
  tips: [],
  isActive: true,
  sortOrder: 0,
  categories,
});

describe('size guides', () => {
  const guides = [guide('women'), guide('men')];

  it("uses the category's own guide, else its parent's", () => {
    expect(sizeGuideForCategory({ id: 'c', nameHe: '', nameEn: '', slug: 'women', sizeGuideId: 'women' }, guides)?.id).toBe('women');
    expect(
      sizeGuideForCategory(
        { id: 'c', nameHe: '', nameEn: '', slug: 'bikini', sizeGuideId: null, parent: { id: 'p', nameHe: '', nameEn: '', slug: 'men', sizeGuideId: 'men' } },
        guides,
      )?.id,
    ).toBe('men');
  });

  it('returns null without a link, or when the linked guide is hidden', () => {
    expect(sizeGuideForCategory({ id: 'c', nameHe: '', nameEn: '', slug: 'x' }, guides)).toBeNull();
    expect(sizeGuideForCategory({ id: 'c', nameHe: '', nameEn: '', slug: 'x', sizeGuideId: 'kids' }, guides)).toBeNull();
    expect(sizeGuideForCategory(undefined, guides)).toBeNull();
  });

  it('picks the language, falling back to the other one', () => {
    expect(localized('he', 'נשים', 'Women')).toBe('נשים');
    expect(localized('en', 'נשים', 'Women')).toBe('Women');
    expect(localized('en', 'נשים', null)).toBe('נשים');
    expect(localized('he', null, null)).toBe('');
  });

  it('links "Shop" to the first top-level category', () => {
    const g = guide('women', [
      { id: '1', slug: 'women-bikini', nameHe: '', nameEn: '', parentId: '2' },
      { id: '2', slug: 'women', nameHe: '', nameEn: '', parentId: null },
    ]);
    expect(shopCategoryFor(g)?.slug).toBe('women');
    expect(shopCategoryFor(guide('kids'))).toBeNull();
  });
});
