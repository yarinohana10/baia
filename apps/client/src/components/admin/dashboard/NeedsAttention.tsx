import { useLocale, useTranslations } from 'next-intl';
import { BellRing, CheckCircle2, Mail, PackageCheck, PackageX, TriangleAlert, Undo2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import type { AdminCounts } from '@/components/admin/AdminShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Attention } from './types';

type Row = { key: string; label: string; count: number | undefined; note?: string; href: string; icon: LucideIcon };

/** Work waiting on the admin, whatever range is selected below. */
export function NeedsAttention({ attention, counts }: { attention: Attention | null; counts: AdminCounts | null }) {
  const t = useTranslations('admin.attention');
  const tn = useTranslations('admin.dashboard.needs');
  const locale = useLocale();

  const rows: Row[] = [
    { key: 'toProcess', label: t('ordersToFulfil'), count: attention?.ordersToProcess ?? counts?.ordersToFulfil, href: '/admin/orders?status=CONFIRMED', icon: PackageCheck },
    {
      key: 'refunds',
      label: tn('pendingRefunds'),
      count: attention?.pendingRefunds.count,
      note: attention && attention.pendingRefunds.count > 0 ? formatWholeShekels(attention.pendingRefunds.amount) : undefined,
      href: '/admin/orders?status=CANCELLED',
      icon: Wallet,
    },
    { key: 'cancellations', label: t('pendingCancellations'), count: attention?.pendingCancellations ?? counts?.pendingCancellations, href: '/admin/cancellations', icon: Undo2 },
    {
      key: 'low',
      label: tn('lowStock'),
      count: attention?.lowStockCount,
      note: attention ? tn('threshold', { count: attention.lowStockThreshold }) : undefined,
      href: '/admin/products',
      icon: TriangleAlert,
    },
    { key: 'out', label: tn('outOfStock'), count: attention?.outOfStockCount, href: '/admin/products', icon: PackageX },
    { key: 'messages', label: t('newContactMessages'), count: counts?.newContactMessages, href: '/admin/messages', icon: Mail },
  ];
  const known = rows.every((r) => r.count !== undefined);
  const total = rows.reduce((sum, r) => sum + (r.count ?? 0), 0);

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-ocean-700" />
          <CardTitle className="font-serif text-xl">{t('title')}</CardTitle>
        </div>
        {counts && counts.newOrders > 0 && (
          <span className="rounded-full bg-ocean-700 px-2.5 py-1 font-body text-xs text-white">{t('newOrders', { count: counts.newOrders })}</span>
        )}
      </CardHeader>
      <CardContent>
        {known && total === 0 ? (
          <p className="flex items-center gap-2 font-body text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-green-600" /> {t('allClear')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const count = row.count;
              return (
                <li key={row.key}>
                  <Link href={row.href} className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${count ? 'bg-amber-50 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      <row.icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-2xl leading-none text-foreground">{count === undefined ? '–' : formatCount(count, locale)}</p>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {row.label}
                        {row.note && <span className="ms-1">· {row.note}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
