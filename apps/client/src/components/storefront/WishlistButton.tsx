'use client';

import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useWishlistStore, type WishlistProduct } from '@/store/wishlist';

type Props = {
  product: WishlistProduct;
  /** Classes for the button; `activeClassName` is added when wishlisted. */
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  iconSize?: number;
};

/**
 * Heart toggle. Guests: saved in localStorage. Signed-in users: saved on the
 * server (and the local list is merged on sign-in by SessionSync).
 */
export function WishlistButton({ product, className, activeClassName, inactiveClassName, iconSize = 16 }: Props) {
  const t = useTranslations('wishlist');
  const active = useWishlistStore((s) => product.id in s.products);
  const toggle = useWishlistStore((s) => s.toggle);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Cards wrap the button in a link.
    e.preventDefault();
    e.stopPropagation();
    void toggle(product);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t('remove') : t('add')}
      title={active ? t('remove') : t('add')}
      className={cn(className, active ? activeClassName : inactiveClassName)}
    >
      <Heart size={iconSize} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
