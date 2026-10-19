'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { OrderRow } from './OrderRow';
import type { AdminOrder } from './types';

/** `admin.orders` keys of the table's columns, before the actions column. */
const COLUMNS = ['order', 'customer', 'items', 'delivery', 'total', 'status', 'date'] as const;

/** The admin orders table; `onView` opens an order's details. */
export function OrdersTable({
  orders,
  onView,
}: {
  orders: AdminOrder[];
  onView: (id: string, trigger: HTMLElement) => void;
}) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              {COLUMNS.map((column) => (
                <th key={column} className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {column === 'delivery' ? tx('delivery') : t(column)}
                </th>
              ))}
              <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noOrders')}
                </td>
              </tr>
            ) : (
              orders.map((order) => <OrderRow key={order.id} order={order} onView={onView} />)
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
