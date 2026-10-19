'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useFileDownload } from '@/hooks/admin/useFileDownload';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { SALES_DAYS } from './constants';
import { SalesChart } from './SalesChart';
import type { SalesDay } from './types';

/** YYYY-MM-DD in the admin's local time zone. */
function isoDay(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/** The sales chart's range: the last SALES_DAYS local days, today included. */
function salesRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (SALES_DAYS - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

/** Sales chart for the last 30 days, with an orders CSV export for the same range. */
export function SalesOverviewCard({ days }: { days: SalesDay[] }) {
  const t = useTranslations('admin.dashboard');
  const tx = useTranslations('admin.attention');
  const { downloading, download } = useFileDownload();
  const [exportError, setExportError] = useState(false);

  const exportOrders = async () => {
    setExportError(false);
    const { from, to } = salesRange();
    const ok = await download(
      () =>
        api
          // Exact instants, so the range follows the admin's local days.
          .get('/admin/orders/export', {
            params: { from: from.toISOString(), to: to.toISOString() },
            responseType: 'blob',
          })
          .then((res) => res.data as Blob),
      `baia-orders-${isoDay(from)}_${isoDay(to)}.csv`,
    );
    if (!ok) setExportError(true);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="font-serif text-xl">{t('salesOverview')}</CardTitle>
          <CardDescription>{t('last30days')}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={exportOrders}
            disabled={downloading}
            aria-busy={downloading}
            title={tx('exportHint')}
          >
            <Download size={14} />
            {downloading ? tx('exporting') : t('export')}
          </Button>
          {exportError && <p role="alert" className="font-body text-xs text-destructive">{tx('exportFailed')}</p>}
        </div>
      </CardHeader>
      <CardContent>
        {days.length > 0 ? (
          <SalesChart days={days} />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="font-body text-sm text-muted-foreground">{t('noSalesData')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
