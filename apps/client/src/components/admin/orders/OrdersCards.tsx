'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { OrderActions } from '@/hooks/admin/useOrderActions';
import { OrderCard } from './OrderCard';
import type { AdminOrder } from './types';

/** The admin orders as cards: one column on phones, two on wide screens. */
export function OrdersCards({
  orders,
  loaded,
  actions,
  onDetails,
}: {
  orders: AdminOrder[];
  loaded: boolean;
  actions: OrderActions;
  onDetails: (id: string) => void;
}) {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.orderCards');

  if (!loaded) return <p className="py-12 text-center text-sm text-muted-foreground">{tc('loading')}</p>;
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">{t('noOrders')}</CardContent>
      </Card>
    );
  }
  return (
    <ul className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {orders.map((order) => (
        <li key={order.id} className="min-w-0">
          <OrderCard order={order} actions={actions} onDetails={onDetails} />
        </li>
      ))}
    </ul>
  );
}
