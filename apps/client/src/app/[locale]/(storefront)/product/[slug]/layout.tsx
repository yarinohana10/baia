import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getProduct } from '@/lib/catalog/server';
import { isInStock, isSaleActive } from '@/lib/catalog/pricing';
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import type { Product } from '@/lib/catalog/types';

/**
 * PDP SEO lives here (not in page.tsx) so the interactive product page/gallery can
 * evolve independently. Rendered on the server from the cached catalogue read.
 */

type Props = { params: Promise<{ locale: string; slug: string }> };

const nameOf = (c: { nameHe: string; nameEn: string }, locale: string) => (locale === 'he' ? c.nameHe : c.nameEn);

function plainText(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const name = nameOf(product, locale);
  const description =
    plainText(locale === 'he' ? product.descriptionHe : product.descriptionEn) ??
    t('productFallbackDescription', { name });
  return pageMetadata({
    locale,
    path: `/product/${slug}`,
    title: name,
    description,
    images: product.images.slice(0, 1).map((img) => ({ url: img.url, alt: name })),
  });
}

function productJsonLd(product: Product, locale: string) {
  const url = absoluteUrl(locale, `/product/${product.slug}`);
  const base = parseFloat(product.basePrice);
  const offers = product.variants.map((v) => {
    const price = isSaleActive(v) ? parseFloat(v.salePrice!) : parseFloat(v.priceOverride || product.basePrice);
    return {
      '@type': 'Offer',
      sku: v.sku,
      price: price.toFixed(2),
      priceCurrency: 'ILS',
      availability: isInStock(v) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url,
    };
  });
  const prices = offers.map((o) => parseFloat(o.price));
  const anyInStock = product.variants.some(isInStock);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: nameOf(product, locale),
    description: plainText(locale === 'he' ? product.descriptionHe : product.descriptionEn, 5000),
    image: product.images.map((i) => i.url),
    sku: product.slug,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: product.category ? nameOf(product.category, locale) : undefined,
    url,
    offers:
      offers.length > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'ILS',
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: offers.length,
            availability: anyInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            offers,
          }
        : offers[0] ?? {
            '@type': 'Offer',
            price: base.toFixed(2),
            priceCurrency: 'ILS',
            availability: 'https://schema.org/OutOfStock',
            url,
          },
  };
}

export default async function ProductLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { locale, slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const t = await getTranslations({ locale, namespace: 'storefront' });
  const cat = product.category;
  const crumbs = [
    { name: t('home'), url: absoluteUrl(locale, '/') },
    ...(cat?.parent ? [{ name: nameOf(cat.parent, locale), url: absoluteUrl(locale, `/category/${cat.parent.slug}`) }] : []),
    ...(cat ? [{ name: nameOf(cat, locale), url: absoluteUrl(locale, `/category/${cat.slug}`) }] : []),
    { name: nameOf(product, locale), url: absoluteUrl(locale, `/product/${product.slug}`) },
  ];

  return (
    <>
      <JsonLd data={[productJsonLd(product, locale), breadcrumbJsonLd(crumbs)]} />
      {children}
    </>
  );
}
