'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Heart, Trash2 } from 'lucide-react';
import ProductCard from '@/components/storefront/ProductCard';

type WishlistItem = {
  id: string;
  product: {
    id: string;
    nameHe: string;
    nameEn: string;
    slug: string;
    basePrice: string;
    images: { url: string }[];
    variants: {
      salePrice?: string | null;
      saleStart?: string | null;
      saleEnd?: string | null;
      priceOverride?: string | null;
    }[];
  };
};

export default function WishlistPage() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchWishlist = async () => {
    try {
      const res = await api.get('/wishlist');
      setItems(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWishlist(); }, []);

  const handleRemove = async (productId: string) => {
    await api.delete(`/wishlist/${productId}`);
    setItems(items.filter((item) => item.product.id !== productId));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
        <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">{t('wishlist')}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="aspect-[3/4] bg-gray-200 mb-3" />
              <div className="h-4 bg-gray-200 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 text-center">
        <Heart size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-400 mb-4">Please log in to view your wishlist.</p>
        <Link
          href="/login"
          className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider hover:bg-ocean-800 transition-colors"
        >
          {t('login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-light tracking-[0.2em] uppercase mb-8">
        {t('wishlist')} ({items.length})
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">Your wishlist is empty.</p>
          <Link
            href="/"
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider hover:bg-ocean-800 transition-colors"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <ProductCard product={item.product} />
              <button
                onClick={() => handleRemove(item.product.id)}
                className="absolute top-2 end-2 z-10 p-1.5 bg-white/90 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
