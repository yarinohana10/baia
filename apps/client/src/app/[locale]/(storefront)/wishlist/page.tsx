'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Heart, Trash2 } from 'lucide-react';
import ProductCard from '@/components/storefront/ProductCard';
import { useWishlistStore } from '@/store/wishlist';

/**
 * Guests: the list lives in localStorage (no account needed).
 * Signed-in users: loaded from the server; SessionSync merges the local list
 * into the account on sign-in.
 */
export default function WishlistPage() {
  const t = useTranslations('common');
  const tWishlist = useTranslations('wishlist');
  const { products, ready, mode, remove, refreshGuest } = useWishlistStore();
  useEffect(() => {
    if (ready && mode === 'guest') void refreshGuest();
  }, [ready, mode, refreshGuest]);
  const items = Object.values(products);

  if (!ready) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
        <h1 className="mb-8 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{t('wishlist')}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="aspect-[3/4] bg-gray-200 rounded-none mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="mb-2 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">
        {t('wishlist')} ({items.length})
      </h1>
      {mode === 'guest' && (
        <p className="text-sm text-gray-500 mb-8">
          {tWishlist('guestNote')}{' '}
          <Link href="/login" className="text-black underline underline-offset-2">
            {t('login')}
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">{tWishlist('empty')}</p>
          <Link
            href="/"
            className="inline-block bg-black text-white px-8 py-3 text-sm tracking-wider rounded-none hover:bg-neutral-800 transition-colors"
          >
            {tWishlist('browse')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mt-8">
          {items.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard product={product} />
              <button
                onClick={() => void remove(product.id)}
                aria-label={tWishlist('remove')}
                className="absolute top-2 start-2 z-10 p-1.5 bg-white/90 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors"
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
