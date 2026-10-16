import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSitemap, STATIC_PATHS } from '../sitemap';
import type { Category, Product } from '../catalog/types';

const cat = (slug: string, children: Category[] = [], parentId: string | null = null): Category => ({
  id: slug,
  slug,
  nameHe: slug,
  nameEn: slug,
  image: null,
  parentId,
  children,
});

const product = (slug: string): Product => ({
  id: slug,
  slug,
  nameHe: slug,
  nameEn: slug,
  basePrice: '100',
  updatedAt: '2026-09-05T20:00:00.000Z',
  images: [],
  variants: [],
});

describe('buildSitemap', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.example'));

  it('includes static pages, nested categories and products in both locales', () => {
    const map = buildSitemap([cat('men', [cat('men-swim-shorts', [], 'men')]), cat('women')], [product('classic-blue')]);
    const urls = map.map((e) => e.url);

    expect(map).toHaveLength((STATIC_PATHS.length + 3 + 1) * 2);
    expect(urls).toContain('https://baia.example/he');
    expect(urls).toContain('https://baia.example/en/shipping');
    expect(urls).toContain('https://baia.example/he/category/men-swim-shorts');
    expect(urls).toContain('https://baia.example/en/product/classic-blue');
  });

  it('adds hreflang alternates and product lastModified', () => {
    const [entry] = buildSitemap([], [product('p1')]).filter((e) => e.url.endsWith('/he/product/p1'));
    expect(entry.alternates?.languages).toMatchObject({
      en: 'https://baia.example/en/product/p1',
      'x-default': 'https://baia.example/he/product/p1',
    });
    expect(entry.lastModified).toEqual(new Date('2026-09-05T20:00:00.000Z'));
  });

  it('never lists private routes', () => {
    const urls = buildSitemap([cat('men')], []).map((e) => e.url).join(' ');
    for (const p of ['/admin', '/account', '/cart', '/checkout']) expect(urls).not.toContain(p);
  });
});
