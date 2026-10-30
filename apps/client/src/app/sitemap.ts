import type { MetadataRoute } from 'next';
import { getCategories, getProducts, getSizeGuides } from '@/lib/catalog/server';
import { buildSitemap } from '@/lib/sitemap';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, firstPage, sizeGuides] = await Promise.all([
    getCategories(),
    getProducts({ limit: 100, page: 1 }),
    getSizeGuides(),
  ]);
  const products = [...firstPage.products];
  for (let page = 2; page <= Math.min(firstPage.totalPages, 50); page++) {
    products.push(...(await getProducts({ limit: 100, page })).products);
  }
  return buildSitemap(categories, products, sizeGuides.map((g) => g.slug));
}
