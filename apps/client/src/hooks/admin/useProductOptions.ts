'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProductCategory } from '@/components/admin/product-form/types';
import type { SizeSet } from '@/components/admin/product-form/stock-variants';

/** Categories and size sets the product form offers; `onCategories` runs once categories arrive. */
export function useProductOptions(onCategories: (categories: ProductCategory[]) => void) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get<ProductCategory[]>('/categories').then((res) => {
      if (cancelled) return;
      setCategories(res.data);
      onCategories(res.data);
    });
    api.get<SizeSet[]>('/size-sets').then((res) => {
      if (!cancelled) setSizeSets(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [onCategories]);

  return { categories, sizeSets };
}
