import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { absoluteUrl, languageAlternates } from './seo';
import type { Category, Product } from './catalog/types';

export const STATIC_PATHS = [
  '/',
  '/new-arrivals',
  '/featured',
  '/about',
  '/shipping',
  '/returns',
  '/contact',
  '/terms',
  '/privacy',
  '/accessibility',
];

type Entry = MetadataRoute.Sitemap[number];

function entriesFor(path: string, extra: Partial<Entry> = {}): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: absoluteUrl(locale, path),
    alternates: { languages: languageAlternates(path) },
    ...extra,
  }));
}

function flatten(categories: Category[]): Category[] {
  return categories.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

/** Pure builder so it can be unit-tested without the API. */
export function buildSitemap(categories: Category[], products: Product[]): MetadataRoute.Sitemap {
  return [
    ...STATIC_PATHS.flatMap((p) =>
      entriesFor(p, { changeFrequency: p === '/' ? 'daily' : 'monthly', priority: p === '/' ? 1 : 0.5 }),
    ),
    ...flatten(categories).flatMap((c) =>
      entriesFor(`/category/${c.slug}`, { changeFrequency: 'weekly', priority: c.parentId ? 0.7 : 0.8 }),
    ),
    ...products.flatMap((p) =>
      entriesFor(`/product/${p.slug}`, {
        changeFrequency: 'weekly',
        priority: 0.6,
        ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
      }),
    ),
  ];
}
