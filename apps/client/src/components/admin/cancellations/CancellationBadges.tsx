'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAdminDate } from '@/lib/admin/format';
import type { AdminCancellation } from './types';

/** Cancellation window, return needed, unpaid and request date chips. */
export function CancellationBadges({ request, windowHours }: { request: AdminCancellation; windowHours: number }) {
  const t = useTranslations('admin.cancellations');
  const locale = useLocale();
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
          request.insideWindow ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
        )}
      >
        <Clock size={12} />
        {request.insideWindow ? t('insideWindow', { hours: windowHours }) : t('outsideWindow', { hours: windowHours })}
      </span>
      {request.requiresReturn && (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-purple-700">
          <RotateCcw size={12} /> {t('requiresReturn')}
        </span>
      )}
      {!request.order.paid && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{t('unpaid')}</span>}
      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
        {t('requestedAt', { date: formatAdminDate(request.createdAt, locale, 'shortTime') })}
      </span>
    </div>
  );
}
