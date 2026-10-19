'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEADLINE, formatOrderDate } from './order-dates';

/** "Free cancellation until Sunday 14:30, 3.6" (or the unpaid / no-deadline wording). */
export function SelfCancelWindow({
  unpaid,
  deadline,
  className,
}: {
  unpaid: boolean;
  deadline: string | null;
  /** Text colour of the line. */
  className: string;
}) {
  const t = useTranslations('cancellation');
  const locale = useLocale();
  let text = t('freeNow');
  if (unpaid) text = t('unpaidCanCancel');
  else if (deadline) text = t('freeUntil', { deadline: formatOrderDate(DEADLINE, deadline, locale) });
  return (
    <p className={cn('flex items-start gap-2 text-sm', className)}>
      <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
      <span>{text}</span>
    </p>
  );
}
