'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ORDER_STATUS_LABEL_KEYS } from '@/components/admin/order-status';

function isKnownStatus(status: string): status is keyof typeof ORDER_STATUS_LABEL_KEYS {
  return Object.hasOwn(ORDER_STATUS_LABEL_KEYS, status);
}

/** Translated label of an order status (unknown statuses are shown as is). */
export function useOrderStatusLabel(): (status: string) => string {
  const t = useTranslations('admin.orders');
  return useCallback((status: string) => (isKnownStatus(status) ? t(ORDER_STATUS_LABEL_KEYS[status]) : status), [t]);
}
