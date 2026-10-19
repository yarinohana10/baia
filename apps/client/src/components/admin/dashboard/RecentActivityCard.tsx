import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatWholeShekels } from '@/lib/admin/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { orderStatusLabelKey } from './constants';
import type { RecentOrder } from './types';

function timeAgo(
  dateStr: string,
  t: (key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo', values?: { count: number }) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { count: days });
}

/** Latest orders, each linking to the orders list filtered to it. */
export function RecentActivityCard({ orders }: { orders: RecentOrder[] }) {
  const t = useTranslations('admin.dashboard');
  const tOrders = useTranslations('admin.orders');

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl">{t('recentActivity')}</CardTitle>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1 font-body text-xs font-medium text-ocean-700 hover:text-ocean-600"
        >
          {t('viewAll')}
          <ArrowUpRight size={14} />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noRecentOrders')}</p>
          ) : (
            orders.map((order) => {
              const statusKey = orderStatusLabelKey(order.status);
              return (
                <Link
                  key={order.id}
                  href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                  className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-medium text-foreground">{order.orderNumber}</p>
                    <p className="truncate font-body text-xs text-muted-foreground">{order.customerEmail}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-body text-sm font-semibold text-foreground">{formatWholeShekels(order.total)}</p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {statusKey ? tOrders(statusKey) : order.status}
                      {' · '}
                      {timeAgo(order.createdAt, t)}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <Link
          href="/admin/orders"
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-muted py-2.5 font-body text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
        >
          {t('viewAllActivity')}
        </Link>
      </CardContent>
    </Card>
  );
}
