'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addressesApi, type Address, type AddressInput } from '@/lib/addresses';

/**
 * Signed-in shoppers' address book at checkout. Calls `onPreferred` (keep it
 * stable) once with the default (or first) address so the form starts from it.
 */
export function useSavedAddresses(userId: string | undefined, onPreferred: (address: Address) => void) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!userId) {
      setAddresses([]);
      return;
    }
    let cancelled = false;
    addressesApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred && !prefilled.current) {
          prefilled.current = true;
          onPreferred(preferred);
        }
      })
      // The address book is a convenience: checkout works without it.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, onPreferred]);

  /** Best effort: a failure here must never get in the way of paying. */
  const save = useCallback((input: AddressInput) => {
    addressesApi
      .create(input)
      .then((created) => setAddresses((list) => [...list, created]))
      .catch(() => undefined);
  }, []);

  return { addresses, save };
}
