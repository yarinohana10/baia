'use client';

import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { WishlistButton } from './WishlistButton';
import type { CardProduct } from '@/lib/catalog/types';
import {
  activeSalePrice,
  formatPrice,
  isNewProduct,
  LOW_STOCK_THRESHOLD,
  sizesInStock,
  swatchColor,
  totalStock,
  uniqueColors,
} from '@/lib/catalog/pricing';

type Props = {
  product: CardProduct;
  /** Set for above-the-fold cards so the first image is preloaded (LCP). */
  priority?: boolean;
  sizes?: string;
};

const DEFAULT_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';

export default function ProductCard({ product, priority = false, sizes = DEFAULT_SIZES }: Props) {
  const locale = useLocale();
  const t = useTranslations('storefront.card');

  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const basePrice = parseFloat(product.basePrice);
  const salePrice = activeSalePrice(product.variants);
  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;
  const stock = totalStock(product.variants);
  const outOfStock = stock === 0;
  const lowStock = !outOfStock && stock <= LOW_STOCK_THRESHOLD;
  const isNew = isNewProduct(product.createdAt);
  const colors = uniqueColors(product.variants);
  const sizesAvailable = sizesInStock(product.variants);
  const [primary, secondary] = product.images;
  const href = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-sand-100">
        {primary ? (
          <>
            <Image
              src={primary.url}
              alt={name}
              fill
              priority={priority}
              sizes={sizes}
              className={`object-cover transition-[opacity,transform] duration-700 ease-[var(--ease-tide)] group-hover:scale-[1.03] ${
                secondary ? 'md:group-hover:opacity-0' : ''
              } ${outOfStock ? 'opacity-60' : ''}`}
            />
            {secondary && (
              <Image
                src={secondary.url}
                alt=""
                fill
                sizes={sizes}
                className="hidden object-cover opacity-0 transition-opacity duration-700 ease-[var(--ease-tide)] md:block md:group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span dir="ltr" className="font-display text-2xl tracking-[0.3em] text-sand-400">BAIA</span>
          </div>
        )}

        {/* Badges */}
        <div className="pointer-events-none absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {outOfStock ? (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">
              {t('outOfStock')}
            </span>
          ) : (
            <>
              {salePrice !== null && (
                <span className="rounded-full bg-coral px-2.5 py-1 text-[11px] font-semibold text-white">
                  <span dir="ltr">-{discountPct}%</span>
                </span>
              )}
              {isNew && (
                <span className="rounded-full bg-sun px-2.5 py-1 text-[11px] font-semibold text-ink">
                  {t('new')}
                </span>
              )}
              {lowStock && (
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-coral-dark">
                  {t('lowStock')}
                </span>
              )}
            </>
          )}
        </div>

        {/* ── Wishlist slot ── */}
        <div className="absolute end-3 top-3 z-10">
          <WishlistButton
            product={product}
            className="rounded-full p-2 backdrop-blur-sm transition-all duration-200"
            activeClassName="bg-white text-coral"
            inactiveClassName="bg-white/80 text-ink hover:bg-white hover:text-coral md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          />
        </div>
        {/* ── /Wishlist slot ── */}

        {/* Sizes in stock — revealed on hover (desktop) */}
        {sizesAvailable.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-2 items-center justify-center gap-1.5 bg-white/90 px-3 py-2 text-[12px] font-semibold text-ink opacity-0 backdrop-blur-sm transition-all duration-300 md:flex md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
            {sizesAvailable.map((s) => (
              <span key={s} className="min-w-6 text-center">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col pt-3">
        <h3 className="text-[15px] leading-snug font-semibold text-ink">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] hover:underline hover:decoration-1 hover:underline-offset-4"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-1 flex items-baseline gap-2">
          {salePrice !== null ? (
            <>
              <span className="text-[15px] font-semibold text-coral">
                <span className="sr-only">{t('salePrice')}: </span>
                {formatPrice(salePrice)}
              </span>
              <s className="text-[13px] text-stone">
                <span className="sr-only">{t('originalPrice')}: </span>
                {formatPrice(basePrice)}
              </s>
            </>
          ) : (
            <span className="text-[15px] text-ink">{formatPrice(basePrice)}</span>
          )}
        </div>

        {colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {colors.slice(0, 5).map((c) => {
              const swatch = swatchColor(c);
              return swatch ? (
                <span
                  key={c}
                  title={c}
                  className="size-3 rounded-full ring-1 ring-ink/20 ring-offset-1 ring-offset-shell"
                  style={{ backgroundColor: swatch }}
                />
              ) : null;
            })}
            <span className="ms-1 text-[12px] text-stone">{t('colors', { count: colors.length })}</span>
          </div>
        )}
      </div>
    </article>
  );
}
