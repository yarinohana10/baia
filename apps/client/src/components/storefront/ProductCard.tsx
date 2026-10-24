'use client';

import { useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WishlistButton } from './WishlistButton';
import type { CardProduct } from '@/lib/catalog/types';
import { activeSalePrice, formatPrice, totalStock } from '@/lib/catalog/pricing';

type Props = {
  product: CardProduct;
  /** Set for above-the-fold cards so the first image is preloaded (LCP). */
  priority?: boolean;
  sizes?: string;
};

const DEFAULT_SIZES = '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw';
/** Minimum horizontal finger travel (px) that counts as a swipe between photos. */
const SWIPE_PX = 40;

export default function ProductCard({ product, priority = false, sizes = DEFAULT_SIZES }: Props) {
  const locale = useLocale();
  const t = useTranslations('productCard');
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const basePrice = parseFloat(product.basePrice);
  const salePrice = activeSalePrice(product.variants);
  const images = product.images;
  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;
  // Back Soon: set by an Admin, or automatic once every size is sold out.
  // Unlimited-stock variants count as Infinity, so they never sell out.
  const outOfStock = product.backSoon === true || totalStock(product.variants) === 0;

  // Which photo is showing. Hover (mouse) jumps to the second photo; arrows,
  // dots and swipes move through all of them.
  const [index, setIndex] = useState(0);
  // Highest photo index worth loading: the hover photo, plus the next one once browsing starts.
  // Keeps a listing at two image downloads per card until a shopper looks further.
  const [reach, setReach] = useState(1);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;
  const go = (next: number) => {
    const target = (next + images.length) % images.length;
    setIndex(target);
    setReach((r) => Math.max(r, target + 1));
  };
  const step = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    go(index + dir);
  };

  return (
    <div
      className="group relative"
      onPointerEnter={(e) => {
        if (many && index === 0 && e.pointerType === 'mouse') setIndex(1);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setIndex(0);
      }}
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div
          className="relative aspect-[3/4] overflow-hidden bg-[#F3F3F1]"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (!many || touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < SWIPE_PX) return;
            // Swipe toward the reading direction's "next" side.
            const rtl = document.documentElement.dir === 'rtl';
            go(index + ((dx < 0) !== rtl ? 1 : -1));
          }}
        >
          {images.length > 0 ? (
            images.map((img, i) =>
              i > reach ? null : (
                <Image
                  key={img.url + i}
                  src={img.url}
                  alt={i === 0 ? name : ''}
                  aria-hidden={i === 0 ? undefined : true}
                  fill
                  priority={priority && i === 0}
                  loading={priority && i === 0 ? undefined : 'lazy'}
                  sizes={sizes}
                  // The first photo is the packshot (shown whole on white); later ones are
                  // lifestyle/on-model shots that fill the frame.
                  className={`${i === 0 ? 'object-contain p-2 sm:p-4 mix-blend-multiply' : 'object-cover'} object-center transition-opacity duration-500 ${
                    i === index ? 'opacity-100' : 'opacity-0'
                  } ${outOfStock ? 'grayscale-[60%]' : ''}`}
                />
              ),
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-50">
              <span className="text-xs tracking-[0.3em] text-neutral-300">BAIA</span>
            </div>
          )}

          <div className="absolute top-3 start-3 z-10 flex flex-col items-start gap-1.5">
            {outOfStock && (
              <span className="bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-black">
                {t('backSoon')}
              </span>
            )}
            {salePrice && !outOfStock && discountPct > 0 && (
              <span className="bg-black px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] text-white">
                <span className="sr-only">{t('sale')} </span>
                <span dir="ltr">{t('salePercent', { pct: discountPct })}</span>
              </span>
            )}
          </div>

          {many && (
            <>
              <button
                type="button"
                aria-label={t('prevImage')}
                onClick={(e) => step(e, -1)}
                className="absolute inset-y-0 start-0 z-10 hidden w-12 items-center justify-center text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                  <ChevronRight size={16} className="ltr:hidden" aria-hidden="true" />
                  <ChevronLeft size={16} className="rtl:hidden" aria-hidden="true" />
                </span>
              </button>
              <button
                type="button"
                aria-label={t('nextImage')}
                onClick={(e) => step(e, 1)}
                className="absolute inset-y-0 end-0 z-10 hidden w-12 items-center justify-center text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                  <ChevronLeft size={16} className="ltr:hidden" aria-hidden="true" />
                  <ChevronRight size={16} className="rtl:hidden" aria-hidden="true" />
                </span>
              </button>
              <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5" aria-hidden="true">
                {images.map((img, i) => (
                  <span
                    key={img.url + i}
                    className={`h-[3px] rounded-full transition-all duration-300 ${
                      i === index ? 'w-5 bg-black' : 'w-2.5 bg-black/25'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <WishlistButton
            product={product}
            className="absolute top-2 end-2 z-20 p-2 transition-all duration-200"
            activeClassName="text-black"
            inactiveClassName="text-black/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-black"
          />
        </div>

        <div className="flex flex-col gap-1 px-3 pt-4 pb-8 sm:px-5">
          <h3 className="line-clamp-2 sm:line-clamp-1 text-[12px] sm:text-[13px] uppercase ltr:tracking-[0.04em] text-black">{name}</h3>
          <div className="flex items-baseline gap-2 text-[12px] sm:text-[13px]">
            {salePrice ? (
              <>
                <span className="text-black">{formatPrice(salePrice)}</span>
                <span className="text-black/40 line-through">{formatPrice(basePrice)}</span>
              </>
            ) : (
              <span className="text-black/55">{formatPrice(basePrice)}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
