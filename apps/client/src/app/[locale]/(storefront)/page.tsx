'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ShoppingBag, Plus, Minus, Heart } from 'lucide-react';
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

/* ─── New Arrivals Card ───────────────────────────── */

function NewArrivalCard({ product, locale }: { product: Product; locale: string }) {
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const price = parseFloat(product.basePrice);
  const imageUrl = product.images[0]?.url;
  const t = useTranslations('product');

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex-shrink-0 w-[220px] sm:w-[240px]">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="240px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-gray-300 text-xs">BAIA</span>
            </div>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="absolute top-2.5 end-2.5 p-1.5 rounded-full bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
          >
            <Heart size={14} />
          </button>
        </div>
      </Link>
      <div className="p-3.5">
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1.5 leading-snug hover:text-ocean-700 transition-colors min-h-[2.5rem]">
            {name}
          </h3>
        </Link>
        <p className="text-base font-semibold text-gray-900 text-center mb-3">₪{price.toFixed(0)}</p>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            >
              <Minus size={12} />
            </button>
            <span className="w-6 text-center text-xs font-medium">{qty}</span>
            <button
              onClick={() => setQty(qty + 1)}
              className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            >
              <Plus size={12} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className={`flex-1 h-8 rounded-lg text-xs font-medium tracking-wide flex items-center justify-center gap-1 transition-all duration-300 ${
              added
                ? 'bg-green-500 text-white'
                : 'bg-ocean-700 text-white hover:bg-ocean-600'
            }`}
          >
            <ShoppingBag size={12} />
            {added ? t('added') : t('addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Homepage ────────────────────────────────────── */

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();

  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    api
      .get('/products', { params: { limit: 50 } })
      .then((res) => setProducts(res.data.products || []))
      .finally(() => setLoaded(true));
  }, []);

  const newArrivals = products.slice(0, 12);

  const carouselRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const updateScroll = () => {
      setScrollPos(node.scrollLeft);
      setMaxScroll(node.scrollWidth - node.clientWidth);
    };
    node.addEventListener('scroll', updateScroll);
    updateScroll();
  }, [loaded]);

  const scroll = (dir: 'left' | 'right') => {
    const el = document.getElementById('new-arrivals-scroll');
    if (!el) return;
    const amount = 260;
    el.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const categories = [
    { slug: 'men', label: t('menCategory'), image: '/categories/men.jpg' },
    { slug: 'women', label: t('womenCategory'), image: '/categories/women.jpg' },
    { slug: 'children', label: t('kidsCategory'), image: '/categories/kids.jpg' },
  ];

  return (
    <>
      {/* ─── Hero Banner ──────────────────────────────── */}
      <section className="relative w-full h-[420px] sm:h-[500px] lg:h-[560px] overflow-hidden">
        <Image
          src="/hero/hero-banner.jpg"
          alt="BAIA Swimwear Summer Collection"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent" />

        <div className="absolute inset-0 flex items-center">
          <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 w-full">
            <div className="max-w-lg">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light italic text-white mb-4 leading-tight tracking-wide">
                {t('heroTitle')}
              </h1>
              <p className="text-base sm:text-lg text-white/80 mb-8 font-light leading-relaxed">
                {t('heroSubtitle')}
              </p>
              <Link
                href="/category/men"
                className="inline-block bg-white text-gray-900 px-8 py-3 text-sm font-semibold tracking-widest uppercase border-2 border-white hover:bg-transparent hover:text-white transition-all duration-300"
              >
                {t('heroCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Shop by Category ─────────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-light text-gray-900 mb-8 sm:mb-10">
          {t('shopByCategory')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="group relative h-[280px] sm:h-[320px] lg:h-[380px] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
            >
              <Image
                src={cat.image}
                alt={cat.label}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xl sm:text-2xl font-semibold tracking-wider drop-shadow-lg">
                  {cat.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── New Arrivals Carousel ─────────────────────── */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl font-light text-gray-900">
            {t('newArrivalsTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={scrollPos <= 0}
              className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={scrollPos >= maxScroll - 1}
              className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {loaded && newArrivals.length === 0 ? (
          <p className="text-center text-gray-400 py-12 tracking-wider">
            More products coming soon.
          </p>
        ) : (
          <div
            id="new-arrivals-scroll"
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 snap-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {newArrivals.map((product) => (
              <NewArrivalCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Featured Products Grid ────────────────────── */}
      {products.filter(p => p.isFeatured).length > 0 && (
        <section className="bg-gray-50 py-14 sm:py-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl sm:text-3xl font-light text-gray-900">
                {t('featuredTitle')}
              </h2>
              <Link
                href="/category/men"
                className="text-sm font-medium text-ocean-700 hover:text-ocean-600 transition-colors"
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
