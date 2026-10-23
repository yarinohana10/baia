'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { csvBlob } from '@/lib/admin/csv';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { useFileDownload, saveBlob } from '@/hooks/admin/useFileDownload';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { SERIES_COLOR } from './constants';
import { SegmentedToggle } from './SegmentedToggle';
import { TimeSeriesChart, type SeriesPoint } from './TimeSeriesChart';
import type { Sales } from './types';

type Metric = 'revenue' | 'orders' | 'units';

type SalesOverviewCardProps = {
  sales: Sales | null;
  /** Range params of the current selection, for the server-side orders export. */
  params: Record<string, string>;
  loading: boolean;
};

/** Revenue / orders / units over time for the range, with CSV exports of the chart and of the orders. */
export function SalesOverviewCard({ sales, params, loading }: SalesOverviewCardProps) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const { downloading, download } = useFileDownload();
  const [metric, setMetric] = useState<Metric>('revenue');
  const [exportError, setExportError] = useState(false);

  const count = (v: number) => formatCount(v, locale);
  const formatValue = metric === 'revenue' ? formatWholeShekels : count;
  const points: SeriesPoint[] = (sales?.points ?? []).map((p) => ({
    date: p.date,
    value: p[metric],
    detail:
      metric === 'revenue'
        ? t('sales.detailOrders', { count: count(p.orders) })
        : metric === 'orders'
          ? t('sales.detailRevenue', { amount: formatWholeShekels(p.revenue) })
          : t('sales.detailOrders', { count: count(p.orders) }),
  }));
  const hasSales = (sales?.points ?? []).some((p) => p.orders > 0);

  const exportOrders = async () => {
    setExportError(false);
    const range = sales?.range;
    const ok = await download(
      () => api.get('/admin/analytics/export', { params, responseType: 'blob' }).then((res) => res.data as Blob),
      `baia-orders-${range?.fromDay ?? 'all'}_${range?.toDay ?? 'range'}.csv`,
    );
    if (!ok) setExportError(true);
  };

  const exportChart = () => {
    if (!sales) return;
    const rows = [
      [t('sales.date'), t('sales.metric.revenue'), t('sales.metric.orders'), t('sales.metric.units'), t('delivered.title'), t('delivered.revenue')],
      ...sales.points.map((p) => [p.date, p.revenue, p.orders, p.units, p.delivered, p.deliveredRevenue]),
    ];
    saveBlob(csvBlob(rows), `baia-sales-${sales.range.fromDay}_${sales.range.toDay}-by-${sales.bucket}.csv`);
  };

  return (
    <Card className="lg:col-span-2" aria-busy={loading}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="font-serif text-xl">{t('salesOverview')}</CardTitle>
          <CardDescription>{sales ? t(`sales.by.${sales.bucket}`) : null}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SegmentedToggle
            label={t('sales.measure')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'revenue', label: t('sales.metric.revenue') },
              { value: 'orders', label: t('sales.metric.orders') },
              { value: 'units', label: t('sales.metric.units') },
            ]}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportChart} disabled={!hasSales}>
              <Download size={14} />
              {t('sales.exportChart')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportOrders} disabled={downloading || !sales} aria-busy={downloading}>
              <Download size={14} />
              {downloading ? t('sales.exporting') : t('sales.exportOrders')}
            </Button>
          </div>
          {exportError && (
            <p role="alert" className="font-body text-xs text-destructive">
              {t('sales.exportFailed')}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {sales && hasSales ? (
          <TimeSeriesChart
            points={points}
            bucket={sales.bucket}
            variant="line"
            color={SERIES_COLOR}
            seriesLabel={t(`sales.metric.${metric}`)}
            formatValue={formatValue}
            weekLabel={(date) => t('sales.weekOf', { date })}
            dateColumnLabel={t('sales.date')}
          />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="font-body text-sm text-muted-foreground">{sales ? t('noSalesData') : t('sectionFailed')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
