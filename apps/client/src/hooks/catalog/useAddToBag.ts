'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useCartStore } from '@/store/cart';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import type { Variant } from '@/lib/catalog/types';

type Options = {
  variant: Variant | undefined;
  quantity: number;
  purchasable: boolean;
  /** Called with null when an attempt starts, then with the error if it fails. */
  onError: (error: ErrorMessage | null) => void;
};

/**
 * Add the selected variant to the bag. On success the button shows a check for
 * 2s and the cart drawer (re)opens so the shopper sees the new line.
 */
export function useAddToBag({ variant, quantity, purchasable, onError }: Options) {
  const locale = useLocale();
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const addToBag = async () => {
    if (!variant || adding || !purchasable) return;
    setAdding(true);
    onError(null);
    try {
      await addItem(variant.id, quantity);
    } catch (err) {
      onError(shopErrorMessage(err, locale));
      return;
    } finally {
      setAdding(false);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    closeDrawer();
    setTimeout(() => openDrawer(), 50);
  };

  return { adding, added, addToBag };
}
