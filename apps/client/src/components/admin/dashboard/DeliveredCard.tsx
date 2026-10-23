'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { DELIVERED_COLOR } from './constants';
import { TimeSeriesChart } from './TimeSeriesChart';
import type { Sales, Summary } from './types';

/** Orders delivered per period (counted on the day they were marked delivered). */
export function DeliveredCard({ sales, summary, loading }: { sales: Sales | null; summary: Summary | null; loading: boolean }) {
  const t = useTranslations('admin.dashboard.delivered');
  const locale = useLocale();
  const points = (sales?.points ?? []).map((p) => ({
    date: p.date,
    value: p.delivered,
    detail: t('detail', { amount: formatWholeShekels(p.deliveredRevenue) }),
  }));
  const any = points.some((p) => p.value > 0);

  return (
    <Card className="lg:col-span-2" aria-busy={loading}>
      <CardHeader>
        <CardTitle className="font-serif text-xl">{t('title')}</CardTitle>
        <CardDescription>
          {summary
            ? t('total', {
                count: formatCount(summary.current.delivered, locale),
                amount: formatWholeShekels(summary.current.deliveredRevenue),
              })
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {sales && any ? (
          <TimeSeriesChart
            points={points}
            bucket={sales.bucket}
            variant="bars"
            color={DELIVERED_COLOR}
            seriesLabel={t('title')}
            formatValue={(v) => formatCount(v, locale)}
            weekLabel={(date) => t('weekOf', { date })}
            dateColumnLabel={t('date')}
          />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="font-body text-sm text-muted-foreground">{sales ? t('empty') : t('failed')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
