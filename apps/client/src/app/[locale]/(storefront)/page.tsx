'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import ProductCard from '@/components/storefront/ProductCard';

type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  isFeatured: boolean;
  images: { url: string; color?: string }[];
  variants: {
    salePrice?: string | null;
    saleStart?: string | null;
    saleEnd?: string | null;
    priceOverride?: string | null;
  }[];
};

type CategoryData = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  image: string | null;
  children?: CategoryData[];
};

type SiteConfigData = {
  heroImageUrl: string | null;
  heroTitleHe: string | null;
  heroTitleEn: string | null;
  heroSubtitleHe: string | null;
  heroSubtitleEn: string | null;
  heroCtaUrl: string | null;
};

/* ─── New Arrival Card (horizontal: image left, text right) ─── */

function NewArrivalCard({ product, locale }: { product: Product; locale: string }) {
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const price = parseFloat(product.basePrice);
  const imageUrl = product.images[0]?.url;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex-shrink-0 w-[260px] sm:w-[280px] flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md hover:border-ocean-200 transition-all duration-250 snap-start"
    >
      <div className="relative w-[88px] h-[88px] flex-shrink-0 bg-warm-100 rounded-lg overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="88px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            BAIA
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-center">
        <h3 className="text-[13px] font-medium text-gray-800 line-clamp-2 leading-snug mb-1.5">
          {name}
        </h3>
        <p className="text-[15px] font-semibold text-gray-900">₪{price.toFixed(0)}</p>
      </div>
    </Link>
  );
}

/* ─── Homepage ─── */

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/products', { params: { limit: 50 } }),
      api.get('/categories'),
      api.get('/site-config'),
    ])
      .then(([productsRes, categoriesRes, configRes]) => {
        setProducts(productsRes.data.products || []);
        setCategories(categoriesRes.data || []);
        setSiteConfig(configRes.data || null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const newArrivals = products.slice(0, 12);

  const heroImage = siteConfig?.heroImageUrl || '/hero/hero-banner.png';
  const heroSubtitle = locale === 'he'
    ? (siteConfig?.heroSubtitleHe || t('heroSubtitle'))
    : (siteConfig?.heroSubtitleEn || t('heroSubtitle'));
  const heroCtaUrl = siteConfig?.heroCtaUrl || '/category/men';

  // Map top-level categories with their images from DB
  const categoryCards = categories.map((cat) => ({
    slug: cat.slug,
    label: locale === 'he' ? cat.nameHe : cat.nameEn,
    image: cat.image || `/categories/${cat.slug}.jpg`,
  }));

  return (
    <>
      {/* ─── Hero Banner ──────────────────────────────── */}
      <section className="relative w-full h-[420px] sm:h-[480px] lg:h-[540px] overflow-hidden">
        <Image
          src={heroImage}
          alt="BAIA Swimwear — Summer Collection"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-end">
          <div className="container-page pb-10 sm:pb-14">
            <p className="text-lg sm:text-xl text-white font-bold leading-snug max-w-md drop-shadow-lg mb-8">
              {heroSubtitle}
            </p>
            <Link
              href={heroCtaUrl}
              className="inline-block bg-white text-gray-900 px-10 py-3.5 text-[14px] font-bold tracking-[0.15em] uppercase rounded-lg hover:bg-ocean-700 hover:text-white transition-all duration-300"
            >
              {t('heroCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Shop by Category ─────────────────────────── */}
      <section className="bg-warm-50">
        <div className="container-page py-12 sm:py-16">
          <h2 className="text-[22px] sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8 tracking-tight">
            {t('shopByCategory')}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {categoryCards.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group relative h-[200px] sm:h-[260px] lg:h-[300px] overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300"
              >
                <Image
                  src={cat.image}
                  alt={cat.label}
                  fill
                  sizes="(max-width: 640px) 33vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-600"
                />
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors duration-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-base sm:text-lg lg:text-xl font-bold tracking-[0.1em] uppercase drop-shadow-md">
                    {cat.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── New Arrivals (infinite marquee) ──────────── */}
      <section className="bg-white">
        <div className="container-page pt-12 sm:pt-16 pb-4">
          <h2 className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight mb-6 sm:mb-8">
            {t('newArrivalsTitle')}
          </h2>
        </div>

        {loaded && newArrivals.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm tracking-wide">
            {t('comingSoon')}
          </p>
        ) : newArrivals.length > 0 ? (
          <div className="overflow-hidden pb-12 sm:pb-16 marquee-wrapper">
            <div
              className="marquee-track gap-4"
              style={{ '--marquee-duration': `${newArrivals.length * 4}s` } as React.CSSProperties}
            >
              {[...newArrivals, ...newArrivals].map((product, i) => (
                <NewArrivalCard
                  key={`${product.id}-${i < newArrivals.length ? 'a' : 'b'}`}
                  product={product}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ─── Featured Products Grid ────────────────────── */}
      {products.filter(p => p.isFeatured).length > 0 && (
        <section className="bg-ocean-50/40">
          <div className="container-page py-12 sm:py-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">
                {t('featuredTitle')}
              </h2>
              <Link
                href="/category/men"
                className="text-sm font-medium text-ocean-700 hover:text-ocean-500 transition-colors"
              >
                {t('viewAll')} →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.filter(p => p.isFeatured).slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
