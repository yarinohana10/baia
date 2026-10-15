import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Truck, RotateCcw, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import ProductCard from '@/components/storefront/ProductCard';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { SectionHeading } from '@/components/storefront/SectionHeading';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getCategories, getProducts, getSiteConfig, toCardProduct } from '@/lib/catalog/server';
import { SITE_NAME, absoluteUrl, getSiteUrl, pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: '/',
    title: t('homeTitle'),
    description: t('homeDescription'),
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, { products }, categories, siteConfig] = await Promise.all([
    getTranslations('storefront'),
    getProducts({ limit: 24, sort: 'newest' }),
    getCategories(),
    getSiteConfig(),
  ]);

  const he = locale === 'he';
  const newArrivals = products.slice(0, 8).map(toCardProduct);
  const featured = products.filter((p) => p.isFeatured).slice(0, 8).map(toCardProduct);

  const heroImage = siteConfig?.heroImageUrl || '/hero/hero-banner.jpg';
  const heroTitle = (he ? siteConfig?.heroTitleHe : siteConfig?.heroTitleEn) || t('hero.title');
  const heroSubtitle = (he ? siteConfig?.heroSubtitleHe : siteConfig?.heroSubtitleEn) || t('hero.subtitle');
  const heroCtaUrl = siteConfig?.heroCtaUrl || (categories[0] ? `/category/${categories[0].slug}` : '/new-arrivals');

  const siteUrl = getSiteUrl().toString();

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: siteUrl,
            logo: new URL('/logo/baia-logo.svg', siteUrl).toString(),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: absoluteUrl(locale, '/'),
            inLanguage: he ? 'he-IL' : 'en-US',
          },
        ]}
      />

      {/* ─── Hero ─── */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink">
        <div className="relative h-[78svh] min-h-[480px] max-h-[820px]">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-ink/10 to-transparent rtl:bg-gradient-to-l" />
          <div className="absolute inset-0 flex items-end">
            <div className="container-page pb-12 sm:pb-16 lg:pb-20">
              <div className="max-w-xl text-white [text-shadow:0_1px_24px_rgba(15,42,54,0.35)]">
                <p className="eyebrow mb-4 text-sun">{t('hero.eyebrow')}</p>
                <h1 id="hero-title" className="font-display text-[40px] leading-[1.05] sm:text-6xl lg:text-7xl">
                  {heroTitle}
                </h1>
                <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/85">{heroSubtitle}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={heroCtaUrl}
                    className="inline-flex items-center rounded-[2px] bg-white px-7 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-sun"
                  >
                    {t('hero.ctaPrimary')}
                  </Link>
                  <Link
                    href="/new-arrivals"
                    className="inline-flex items-center rounded-[2px] border border-white/60 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    {t('hero.ctaSecondary')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      {categories.length > 0 && (
        <section aria-labelledby="categories-title" className="container-page py-16 sm:py-24">
          <SectionHeading id="categories-title" eyebrow={t('categories.eyebrow')} title={t('categories.title')} locale={locale} />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
            {categories.map((cat) => {
              const label = he ? cat.nameHe : cat.nameEn;
              return (
                <li key={cat.id}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="group relative block aspect-[16/10] overflow-hidden bg-sand-200 sm:aspect-[4/5] lg:aspect-[5/6]"
                  >
                    {cat.image && (
                      <Image
                        src={cat.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 ease-[var(--ease-tide)] group-hover:scale-[1.04]"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white sm:p-6">
                      <span className="font-display text-3xl sm:text-4xl">{label}</span>
                      <span className="eyebrow border-b border-white/60 pb-0.5 text-[11px]">{t('categories.explore')}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─── New arrivals (scroll-snap rail) ─── */}
      {newArrivals.length > 0 && (
        <section aria-labelledby="new-title" className="bg-foam/50 py-16 sm:py-24">
          <div className="container-page">
            <SectionHeading
              id="new-title"
              eyebrow={t('newArrivals.eyebrow')}
              title={t('newArrivals.title')}
              action={{ label: t('newArrivals.viewAll'), href: '/new-arrivals' }}
              locale={locale}
            />
          </div>
          <ul className="scrollbar-hide container-page flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-5">
            {newArrivals.map((product) => (
              <li key={product.id} className="w-[64vw] shrink-0 snap-start sm:w-[38vw] md:w-[28vw] lg:w-[22vw] xl:w-[300px]">
                <ProductCard product={product} sizes="(max-width: 640px) 64vw, (max-width: 1024px) 38vw, 300px" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Featured ─── */}
      {featured.length > 0 && (
        <section aria-labelledby="featured-title" className="container-page py-16 sm:py-24">
          <SectionHeading
            id="featured-title"
            eyebrow={t('featured.eyebrow')}
            title={t('featured.title')}
            action={{ label: t('featured.viewAll'), href: '/new-arrivals' }}
            locale={locale}
          />
          <ProductGrid products={featured} />
        </section>
      )}

      {/* ─── Values ─── */}
      <section aria-labelledby="values-title" className="border-y border-sand-200 bg-sand-50">
        <h2 id="values-title" className="sr-only">{t('values.title')}</h2>
        <ul className="container-page grid gap-10 py-14 sm:grid-cols-3 sm:gap-8">
          {[
            { icon: Truck, title: t('values.shippingTitle'), body: t('values.shippingBody') },
            { icon: RotateCcw, title: t('values.returnsTitle'), body: t('values.returnsBody') },
            { icon: Users, title: t('values.familyTitle'), body: t('values.familyBody') },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon size={26} strokeWidth={1.3} aria-hidden="true" className="mt-1 shrink-0 text-ocean-700" />
              <div>
                <h3 className="font-display text-xl text-ink">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-stone">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ─── Club CTA ─── */}
      <section aria-labelledby="club-title" className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-3 text-ocean-700">{t('newsletter.eyebrow')}</p>
          <h2 id="club-title" className="font-display text-[32px] leading-tight text-ink sm:text-5xl">
            {t('newsletter.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed text-stone">{t('newsletter.body')}</p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center rounded-[2px] bg-ink px-8 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-coral"
          >
            {t('newsletter.cta')}
          </Link>
        </div>
      </section>
    </>
  );
}

