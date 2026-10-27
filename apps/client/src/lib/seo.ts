import type { Metadata } from 'next';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

export const SITE_NAME = 'BAIA Swimwear';

/** Brand card (logo on the shell background) shown when a page without its own photo is shared. */
export const DEFAULT_SHARE_IMAGE = { url: '/og/baia-share.jpg', width: 1200, height: 630, alt: SITE_NAME };

/** Public origin of the storefront. Set NEXT_PUBLIC_SITE_URL in production. */
export function getSiteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

/** Absolute URL for a locale-prefixed path, e.g. absoluteUrl('he', '/category/men'). */
export function absoluteUrl(locale: string, path = '/'): string {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return new URL(`/${locale}${clean}`, getSiteUrl()).toString();
}

export function ogLocale(locale: string): string {
  return locale === 'he' ? 'he_IL' : 'en_US';
}

/** hreflang map for a path in every locale, plus x-default (English, the default locale). */
export function languageAlternates(path = '/'): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = absoluteUrl(l, path);
  languages['x-default'] = absoluteUrl(defaultLocale, path);
  return languages;
}

type PageMetaInput = {
  locale: string;
  path: string;
  title: string;
  description: string;
  images?: { url: string; alt?: string }[];
  /** Use an absolute title (skip the "| BAIA Swimwear" template). */
  absoluteTitle?: boolean;
  noIndex?: boolean;
};

/** Canonical + hreflang + Open Graph/Twitter for a storefront page. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  images,
  absoluteTitle,
  noIndex,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(locale, path);
  const shareImages = images?.length ? images : [DEFAULT_SHARE_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      type: 'website',
      images: shareImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImages.map((i) => i.url),
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Serialize JSON-LD safely for a <script> tag (escape `<` to avoid breaking out). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
