import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { getSiteUrl } from '@/lib/seo';

const PRIVATE_PATHS = ['/admin', '/account', '/cart', '/checkout', '/order-confirmation', '/wishlist', '/login', '/register'];

export default function robots(): MetadataRoute.Robots {
  const disallow = PRIVATE_PATHS.flatMap((p) => [p, ...locales.map((l) => `/${l}${p}`)]);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: new URL('/sitemap.xml', getSiteUrl()).toString(),
    host: getSiteUrl().origin,
  };
}
