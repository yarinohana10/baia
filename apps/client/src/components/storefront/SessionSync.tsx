'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';

/**
 * Keeps the cart and wishlist in step with the auth session, without touching
 * the login/register pages: whenever this tab sees a (new) signed-in user it
 * merges the guest cart (identified server-side by its httpOnly cookie) and
 * the local wishlist into the account. Both merges are idempotent, so seeing
 * the same user again on a later mount is harmless.
 */
export function SessionSync() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending || lastUserId.current === userId) return;
    lastUserId.current = userId;

    if (!userId) {
      useWishlistStore.getState().loadGuest();
      // After sign-out the cart switches back to the (empty) guest cart.
      void useCartStore.getState().fetchCart();
      return;
    }

    void useCartStore
      .getState()
      .mergeGuestCart()
      .catch(() => useCartStore.getState().fetchCart());
    void useWishlistStore.getState().syncUser();
  }, [userId, isPending]);

  return null;
}
