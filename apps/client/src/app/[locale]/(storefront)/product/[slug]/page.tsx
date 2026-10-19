import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/storefront/Breadcrumbs';
import { ProductDetails } from '@/components/storefront/product/ProductDetails';
import { RelatedProducts } from '@/components/storefront/product/RelatedProducts';
import { getProduct, getRelatedProducts, getSiteConfig, toCardProduct } from '@/lib/catalog/server';
import { businessInfo } from '@/lib/site';

type Props = { params: Promise<{ locale: string; slug: string }> };

const nameOf = (c: { nameHe: string; nameEn: string }, locale: string) => (locale === 'he' ? c.nameHe : c.nameEn);

/**
 * Product page. Rendered on the server from the cached catalogue (SEO + fast
 * first paint); ProductDetails then refreshes stock live in the browser.
 * Metadata and JSON-LD live in layout.tsx.
 */
export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [product, config, related, t, tPdp] = await Promise.all([
    getProduct(slug),
    getSiteConfig(),
    getRelatedProducts(slug, 8),
    getTranslations('storefront'),
    getTranslations('pdp'),
  ]);
  if (!product) notFound();

  const info = businessInfo(config);
  const cat = product.category;
  const crumbs = [
    { label: t('home'), href: '/' },
    ...(cat?.parent ? [{ label: nameOf(cat.parent, locale), href: `/category/${cat.parent.slug}` }] : []),
    ...(cat ? [{ label: nameOf(cat, locale), href: `/category/${cat.slug}` }] : []),
    { label: nameOf(product, locale) },
  ];

  return (
    <div className="container-page pb-28 pt-5 md:pb-16 md:pt-8">
      <div className="mb-5 md:mb-8">
        <Breadcrumbs items={crumbs} label={tPdp('breadcrumbLabel')} locale={locale} />
      </div>

      <ProductDetails
        product={product}
        whatsappNumber={info.whatsappNumber}
        shipping={{
          courierCost: info.courierCost,
          pickupCost: info.pickupCost,
          courierEtaDays: info.courierEtaDays,
          pickupEtaDays: info.pickupEtaDays,
          freeShippingThreshold: info.freeShippingThreshold,
          selfCancelWindowHours: info.selfCancelWindowHours,
        }}
      />

      <RelatedProducts title={tPdp('related')} products={related.map(toCardProduct)} />
    </div>
  );
}
