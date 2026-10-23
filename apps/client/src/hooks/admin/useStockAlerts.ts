'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LOW_STOCK_THRESHOLD } from '@/lib/catalog/pricing';

export type StockAlert = {
  variantId: string;
  productId: string;
  productNameHe: string;
  productNameEn: string;
  color: string;
  size: string;
  sku: string;
  remaining: number;
  soldOut: boolean;
};

/** Sizes at or under the low-stock threshold (and the threshold itself), for the admin panel. Reload after stock edits. */
export function useStockAlerts(reloadKey?: unknown) {
  const [state, setState] = useState<{ threshold: number; items: StockAlert[] }>({ threshold: LOW_STOCK_THRESHOLD, items: [] });
  useEffect(() => {
    let cancelled = false;
    api.get('/admin/inventory/alerts').then(
      (res) => !cancelled && setState({ threshold: res.data.threshold ?? LOW_STOCK_THRESHOLD, items: res.data.items ?? [] }),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  return state;
}
