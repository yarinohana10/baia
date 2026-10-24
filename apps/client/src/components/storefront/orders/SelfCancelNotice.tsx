'use client';

import { useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "You can cancel this order for free until it ships" (or the unpaid wording). */
export function SelfCancelNotice({ unpaid, className }: { unpaid: boolean; className: string }) {
  const t = useTranslations('cancellation');
  return (
    <p className={cn('flex items-start gap-2 text-sm', className)}>
      <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
      <span>{unpaid ? t('unpaidCanCancel') : t('freeUntilShipped')}</span>
    </p>
  );
}
