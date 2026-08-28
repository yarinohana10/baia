'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      <div className="flex-1 min-w-0">
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
  const [loaded, setLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    api
      .get('/products', { params: { limit: 50 } })
      .then((res) => setProducts(res.data.products || []))
      .finally(() => setLoaded(true));
  }, []);

  const newArrivals = products.slice(0, 12);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons();
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [loaded]);

  /* Auto-scroll */
  const [isHovered, setIsHovered] = useState(false);
  useEffect(() => {
    if (isHovered || !loaded || newArrivals.length === 0) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 1, behavior: 'auto' });
      }
    }, 25);
    return () => clearInterval(interval);
  }, [isHovered, loaded, newArrivals.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' });
  };

  const categories = [
    { slug: 'men', label: t('menCategory'), image: '/categories/men.jpg' },
    { slug: 'women', label: t('womenCategory'), image: '/categories/women.jpg' },
    { slug: 'children', label: t('kidsCategory'), image: '/categories/kids.jpg' },
  ];

  return (
    <>
      {/* ─── Hero Banner ──────────────────────────────── */}
      <section className="relative w-full h-[420px] sm:h-[480px] lg:h-[540px] overflow-hidden">
        <Image
          src="/hero/hero-banner.png"
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
              {t('heroSubtitle')}
            </p>
            <Link
              href="/category/men"
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
            {categories.map((cat) => (
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

      {/* ─── New Arrivals ─────────────────────────────── */}
      <section className="bg-white">
        <div className="container-page py-12 sm:py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">
              {t('newArrivalsTitle')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-ocean-50 hover:border-ocean-300 hover:text-ocean-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-ocean-50 hover:border-ocean-300 hover:text-ocean-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {loaded && newArrivals.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm tracking-wide">
              {t('comingSoon')}
            </p>
          ) : (
            <div
              ref={scrollRef}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x"
            >
              {newArrivals.map((product) => (
                <NewArrivalCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          )}
        </div>
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
