'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Product } from '@/lib/catalog/types';

/**
 * The product, refreshed once from the API after mount: the page itself is
 * cached for a few minutes, so this keeps stock (sold-out sizes) accurate.
 */
export function useLiveProduct(initial: Product): Product {
  const [product, setProduct] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/products/${encodeURIComponent(initial.slug)}`)
      .then((res) => {
        if (!cancelled && res.data?.id === initial.id) setProduct(res.data as Product);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial.slug, initial.id]);
  return product;
}
