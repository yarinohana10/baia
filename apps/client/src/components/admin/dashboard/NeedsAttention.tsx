import { useTranslations } from 'next-intl';
import { BellRing, CheckCircle2, Mail, PackageCheck, Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AdminCounts } from '@/components/admin/AdminShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/** Work waiting on the admin; `counts` is null until the counts request answers. */
export function NeedsAttention({ counts }: { counts: AdminCounts | null }) {
  const t = useTranslations('admin.attention');
  const rows = [
    { key: 'pendingCancellations', count: counts?.pendingCancellations ?? 0, href: '/admin/cancellations', icon: Undo2 },
    { key: 'newContactMessages', count: counts?.newContactMessages ?? 0, href: '/admin/messages', icon: Mail },
    { key: 'ordersToFulfil', count: counts?.ordersToFulfil ?? 0, href: '/admin/orders?status=CONFIRMED', icon: PackageCheck },
  ] as const;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <Card className="mb-8">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-ocean-700" />
          <CardTitle className="font-serif text-xl">{t('title')}</CardTitle>
        </div>
        {counts && counts.newOrders > 0 && (
          <span className="rounded-full bg-ocean-700 px-2.5 py-1 font-body text-xs text-white">
            {t('newOrders', { count: counts.newOrders })}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {counts && total === 0 ? (
          <p className="flex items-center gap-2 font-body text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-green-600" /> {t('allClear')}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.map((row) => (
              <Link
                key={row.key}
                href={row.href}
                className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    row.count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <row.icon size={18} />
                </div>
                <div>
                  <p className="font-serif text-2xl leading-none text-foreground">{counts ? row.count : '–'}</p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">{t(row.key)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
