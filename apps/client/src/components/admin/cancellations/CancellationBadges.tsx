'use client';

import { useLocale, useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { formatAdminDate } from '@/lib/admin/format';
import type { AdminCancellation } from './types';

/** Return needed, unpaid and request date chips. */
export function CancellationBadges({ request }: { request: AdminCancellation }) {
  const t = useTranslations('admin.cancellations');
  const locale = useLocale();
  return (
    <div className="flex flex-wrap gap-2 text-xs">
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
