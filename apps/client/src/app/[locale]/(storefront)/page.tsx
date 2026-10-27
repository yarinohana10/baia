import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import ProductCard from '@/components/storefront/ProductCard';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getProducts, getSiteConfig, toCardProduct } from '@/lib/catalog/server';
import type { Product } from '@/lib/catalog/types';
import { SITE_NAME, absoluteUrl, getSiteUrl, pageMetadata } from '@/lib/seo';
import { getLogoUrl } from '@/lib/brand';

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

/* ─── New Arrival Card (marquee item) ─── */

function NewArrivalCard({ product, locale }: { product: Product; locale: string }) {
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const price = parseFloat(product.basePrice);
  const imageUrl = product.images[0]?.url;

  return (
    <Link href={`/product/${product.slug}`} className="group flex-shrink-0 w-[140px] sm:w-[200px]">
      <div className="relative aspect-square overflow-hidden bg-[#F3F3F1]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="200px"
            className="object-contain p-4 sm:p-5 mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs tracking-[0.3em] text-neutral-300">BAIA</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 pt-2.5">
        <h3 className="line-clamp-1 text-[12px] sm:text-[13px] uppercase ltr:tracking-[0.04em] text-black">{name}</h3>
        <p className="text-[12px] sm:text-[13px] text-black/55">₪{price.toFixed(0)}</p>
      </div>
    </Link>
  );
}

/** Centered, uppercase section title in the minimal storefront style. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-[17px] sm:text-[20px] font-semibold uppercase ltr:tracking-[0.06em] text-black">
      {children}
    </h2>
  );
}

/** Text link with an underline, used for "shop now" / "view all". */
const underlineLink =
  'inline-flex min-h-11 items-center text-[12px] font-medium uppercase ltr:tracking-[0.16em] underline decoration-1 underline-offset-[6px] transition-opacity hover:opacity-60';

/* ─── Homepage ─── */

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, { products: newArrivals }, { products: featuredProducts }, siteConfig] = await Promise.all([
    getTranslations('home'),
    getProducts({ limit: 12, sort: 'newest' }),
    // Every Admin-featured product counts, not only the newest ones.
    getProducts({ featured: true, limit: 8, sort: 'newest' }),
    getSiteConfig(),
  ]);

  const he = locale === 'he';
  const featured = featuredProducts.map(toCardProduct);

  const heroImage = siteConfig?.heroImageUrl || '/hero/hero-bar.jpg';

  const siteUrl = getSiteUrl().toString();

  return (
    <div className="bg-white">
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: siteUrl,
            logo: new URL(getLogoUrl(), siteUrl).toString(),
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

      {/* ─── Hero (full-width campaign photo) ─ */}
      <section className="relative aspect-[3/4] overflow-hidden bg-neutral-100 sm:aspect-[16/9] md:aspect-[5/2]">
        <h1 className="sr-only">{t('heroTitle')}</h1>
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[92%_50%] md:object-center"
        />
      </section>

      {/* ─── New Arrivals (infinite marquee) ──────────── */}
      <section className="pt-12 sm:pt-16">
        <SectionTitle>{t('newArrivalsTitle')}</SectionTitle>

        {newArrivals.length === 0 ? (
          <p className="text-center text-black/40 py-12 text-sm tracking-wide">{t('comingSoon')}</p>
        ) : (
          <div className="mt-6 sm:mt-8 overflow-hidden marquee-wrapper">
            <div
              className="marquee-track"
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
        )}
        <div className="mt-4 flex justify-center">
          <Link href="/new-arrivals" className={`${underlineLink} text-black`}>
            {t('viewAll')}
          </Link>
        </div>
      </section>

      {/* ─── Featured Products Grid (edge to edge) ─────── */}
      {featured.length > 0 && (
        <section className="pt-16 sm:pt-24 pb-10 sm:pb-16">
          <SectionTitle>{t('featuredTitle')}</SectionTitle>
          <div className="mt-8 sm:mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Link href="/featured" className={`${underlineLink} text-black`}>
              {t('viewAll')}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
