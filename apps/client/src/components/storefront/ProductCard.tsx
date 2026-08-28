'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Heart, ShoppingBag, Loader2 } from 'lucide-react';
import { useCartStore } from '@/store/cart';

type Props = {
  product: {
    id: string;
    nameHe: string;
    nameEn: string;
    slug: string;
    basePrice: string;
    images: { url: string; color?: string }[];
    variants: {
      id?: string;
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

  const [wishlisted, setWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);

  const { addItem, openDrawer } = useCartStore();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const firstVariant = product.variants.find((v) => v.id);
    if (!firstVariant?.id) return;

    setAdding(true);
    try {
      await addItem(firstVariant.id, 1);
      openDrawer();
    } catch {
      // silently fail
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square bg-white overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-contain object-center group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-ocean-50">
              <span className="text-ocean-300 text-xs tracking-widest uppercase">BAIA</span>
            </div>
          )}

          {salePrice && (
            <div className="absolute top-3 start-3 bg-red-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wider">
              -{discountPct}%
            </div>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWishlisted(!wishlisted);
            }}
            className={`absolute top-3 end-3 p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
              wishlisted
                ? 'bg-red-50 text-red-500'
                : 'bg-white/70 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-white'
            }`}
            aria-label={t('addToCart')}
          >
            <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium text-charcoal tracking-wide mb-2 line-clamp-1 hover:text-ocean-600 transition-colors">
            {name}
          </h3>
        </Link>

        <div className="flex items-center justify-center gap-2 mb-4">
          {salePrice ? (
            <>
              <span className="text-lg font-semibold text-red-500">₪{salePrice.toFixed(0)}</span>
              <span className="text-xs text-gray-400 line-through">₪{basePrice.toFixed(0)}</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-charcoal">₪{basePrice.toFixed(0)}</span>
          )}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={adding || !product.variants.some((v) => v.id)}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-xs font-medium tracking-wider uppercase transition-all duration-300 disabled:opacity-50 bg-ocean-700 text-white hover:bg-ocean-600"
        >
          {adding ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <ShoppingBag size={14} />
              {t('addToCart')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
