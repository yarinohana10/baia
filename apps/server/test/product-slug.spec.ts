import { productSlugBase, uniqueSlug } from '../src/products/product-slug';

describe('product web address (slug)', () => {
  it('prefixes the English name with the top-level category', () => {
    expect(productSlugBase('Enzo Swim Shorts – Onix Leather Look', 'men')).toBe('men-enzo-swim-shorts-onix-leather-look');
    expect(productSlugBase('  Classic   Bikini!! ', 'women')).toBe('women-classic-bikini');
  });

  it('does not repeat the category when the name already starts with it', () => {
    expect(productSlugBase('Women Bikini Set', 'women')).toBe('women-bikini-set');
  });

  it('falls back to the category when the name has no latin letters or digits', () => {
    expect(productSlugBase('בגד ים', 'women')).toBe('women');
    expect(productSlugBase('', '')).toBe('product');
  });

  it('keeps addresses short, ending on a whole word', () => {
    const slug = productSlugBase('word '.repeat(60), 'men');
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(slug).toMatch(/^men(-word)+$/);
  });

  it('adds a number when the address is taken', async () => {
    const taken = new Set(['women-bikini', 'women-bikini-2']);
    await expect(uniqueSlug('women-bikini', async (s) => taken.has(s))).resolves.toBe('women-bikini-3');
    await expect(uniqueSlug('men-shorts', async () => false)).resolves.toBe('men-shorts');
  });
});
