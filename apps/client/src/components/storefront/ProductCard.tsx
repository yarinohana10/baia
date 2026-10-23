'use client';

import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
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

export default function ProductCard({ product, priority = false, sizes = DEFAULT_SIZES }: Props) {
  const locale = useLocale();
  const t = useTranslations('productCard');
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const basePrice = parseFloat(product.basePrice);
  const salePrice = activeSalePrice(product.variants);
  const imageUrl = product.images[0]?.url;
  // Second photo (e.g. back view / on model) swaps in on hover where hover exists.
  const hoverUrl = product.images[1]?.url;
  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;
  // Back Soon: set by an Admin, or automatic once every size is sold out.
  // Unlimited-stock variants count as Infinity, so they never sell out.
  const outOfStock = product.backSoon === true || totalStock(product.variants) === 0;

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-square bg-white overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              priority={priority}
              sizes={sizes}
              className={`object-contain object-center transition-[transform,opacity] duration-500 ${
                hoverUrl ? '[@media(hover:hover)]:group-hover:opacity-0' : 'group-hover:scale-105'
              } ${outOfStock ? 'opacity-70 grayscale' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-ocean-50">
              <span className="text-ocean-300 text-xs tracking-widest uppercase">BAIA</span>
            </div>
          )}

          {imageUrl && hoverUrl && (
            <Image
              src={hoverUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes={sizes}
              loading="lazy"
              className="hidden object-contain object-center opacity-0 transition-opacity duration-500 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100"
            />
          )}

          <div className="absolute top-3 start-3 z-10 flex flex-col items-start gap-1.5">
            {outOfStock && (
              <span className="rounded-full bg-charcoal/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
                {t('backSoon')}
              </span>
            )}
            {salePrice && !outOfStock && discountPct > 0 && (
              <span className="rounded-full bg-coral px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
                <span className="sr-only">{t('sale')} </span>
                <span dir="ltr">{t('salePercent', { pct: discountPct })}</span>
              </span>
            )}
          </div>

          <WishlistButton
            product={product}
            className="absolute top-3 end-3 z-20 p-2 rounded-full backdrop-blur-sm transition-all duration-200"
            activeClassName="bg-red-50 text-red-500"
            inactiveClassName="bg-white/70 text-gray-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-white"
          />
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-charcoal tracking-wide mb-2 line-clamp-1 group-hover:text-ocean-600 transition-colors">
            {name}
          </h3>

          <div className="flex items-center justify-center gap-2">
            {salePrice ? (
              <>
                <span className="text-lg font-semibold text-red-500">{formatPrice(salePrice)}</span>
                <span className="text-xs text-gray-400 line-through">{formatPrice(basePrice)}</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-charcoal">{formatPrice(basePrice)}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
