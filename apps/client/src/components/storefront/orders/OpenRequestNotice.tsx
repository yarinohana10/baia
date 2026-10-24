'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { formatOrderDate, SHORT_DATE } from './order-dates';

/** "You asked to cancel on 14.10.2026; we'll get back to you." */
export function OpenRequestNotice({ createdAt }: { createdAt: string }) {
  const t = useTranslations('cancellation');
  const locale = useLocale();
  return (
    <div className="flex items-start gap-2 rounded-none bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{t('openRequest', { date: formatOrderDate(SHORT_DATE, createdAt, locale) })}</span>
    </div>
  );
}
