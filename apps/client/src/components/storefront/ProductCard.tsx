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
  const t = useTranslations('product');
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const basePrice = parseFloat(product.basePrice);
  const salePrice = activeSalePrice(product.variants);
  const imageUrl = product.images[0]?.url;
  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;
  // Unlimited-stock variants count as Infinity, so they never show as sold out.
  const outOfStock = totalStock(product.variants) === 0;

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
              className="object-contain object-center group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-ocean-50">
              <span className="text-ocean-300 text-xs tracking-widest uppercase">BAIA</span>
            </div>
          )}

          {outOfStock && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <span className="bg-gray-900/80 text-white text-xs font-semibold px-4 py-2 rounded-full tracking-wider uppercase">
                {t('outOfStock')}
              </span>
            </div>
          )}

          {salePrice && !outOfStock && (
            <div className="absolute top-3 start-3 bg-red-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wider">
              -{discountPct}%
            </div>
          )}

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
