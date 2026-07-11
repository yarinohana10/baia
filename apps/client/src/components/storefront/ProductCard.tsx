'use client';

import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';

type Props = {
  product: {
    id: string;
    nameHe: string;
    nameEn: string;
    slug: string;
    basePrice: string;
    images: { url: string; color?: string }[];
    variants: {
      salePrice?: string | null;
      saleStart?: string | null;
      saleEnd?: string | null;
      priceOverride?: string | null;
    }[];
  };
};

function getActiveSale(variants: Props['product']['variants']) {
  const now = new Date();
  for (const v of variants) {
    if (!v.salePrice) continue;
    const start = v.saleStart ? new Date(v.saleStart) : null;
    const end = v.saleEnd ? new Date(v.saleEnd) : null;
    if (start && now < start) continue;
    if (end && now > end) continue;
    return parseFloat(v.salePrice);
  }
  return null;
}

export default function ProductCard({ product }: Props) {
  const locale = useLocale();
  const t = useTranslations('product');
  const name = locale === 'he' ? product.nameHe : product.nameEn;
  const basePrice = parseFloat(product.basePrice);
  const salePrice = getActiveSale(product.variants);
  const imageUrl = product.images[0]?.url;

  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 group-hover:scale-105 transition-transform duration-500" />
        )}

        {salePrice && (
          <div className="absolute top-2 start-2 bg-red-500 text-white text-xs px-2 py-0.5 tracking-wider">
            -{discountPct}%
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-2 end-2 p-1.5 bg-white/80 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
          aria-label="Add to wishlist"
        >
          <Heart size={16} />
        </button>
      </div>

      <h3 className="text-sm font-medium text-charcoal tracking-wide mb-1 line-clamp-1">
        {name}
      </h3>

      <div className="flex items-center gap-2">
        {salePrice ? (
          <>
            <span className="text-sm font-medium text-red-500">₪{salePrice.toFixed(2)}</span>
            <span className="text-xs text-gray-400 line-through">₪{basePrice.toFixed(2)}</span>
          </>
        ) : (
          <span className="text-sm text-gray-600">₪{basePrice.toFixed(2)}</span>
        )}
      </div>
    </Link>
  );
}
