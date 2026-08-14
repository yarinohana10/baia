'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Heart, ShoppingBag, Plus, Minus } from 'lucide-react';

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
  const displayPrice = salePrice ?? basePrice;
  const discountPct = salePrice ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0;

  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 1500);
  };

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <Link href={`/product/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
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

      {/* Info */}
      <div className="p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-sm font-medium text-charcoal tracking-wide mb-2 line-clamp-1 hover:text-ocean-600 transition-colors">
            {name}
          </h3>
        </Link>

        {/* Price - centered */}
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

        {/* Quantity + Add to Cart */}
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQuantity(Math.max(1, quantity - 1));
              }}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-medium text-charcoal select-none">
              {quantity}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setQuantity(quantity + 1);
              }}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium tracking-wider uppercase transition-all duration-300 ${
              addedToCart
                ? 'bg-green-500 text-white'
                : 'bg-ocean-700 text-white hover:bg-ocean-600'
            }`}
          >
            <ShoppingBag size={13} />
            {addedToCart ? t('added') : t('addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}
