'use client';

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import { orderErrorMessage } from '@/components/admin/orders/order-errors';
import type { AdminOrder } from '@/components/admin/orders/types';

/**
 * The order details dialog: loads one order (GET /admin/orders/:id, which also
 * carries every cancellation request) when asked and keeps it while open.
 */
export function useOrderDetail({ setNotice }: { setNotice: Dispatch<SetStateAction<Notice | null>> }) {
  const t = useTranslations('admin.orders');
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const loadingRef = useRef(false);

  const openDetail = useCallback(
    async (id: string) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const res = await api.get<AdminOrder>(`/admin/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        setNotice({ kind: 'error', text: orderErrorMessage(err, t('detailFailed'), t) });
      } finally {
        loadingRef.current = false;
      }
    },
    [setNotice, t],
  );

  const closeDetail = useCallback(() => setOrder(null), []);

  return { order, openDetail, closeDetail };
}

export type OrderDetail = ReturnType<typeof useOrderDetail>;
