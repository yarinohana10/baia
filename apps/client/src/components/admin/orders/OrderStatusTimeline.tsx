'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { formatAdminDate } from '@/lib/admin/format';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import { statusEventActor } from './order-utils';
import type { OrderStatusEvent } from './types';

/** Status history, oldest first: from -> to, when (Israel time) and who changed it (or "system"). */
export function OrderStatusTimeline({ events }: { events: OrderStatusEvent[] }) {
  const t = useTranslations('admin.orderCards.timeline');
  const statusLabel = useOrderStatusLabel();
  const locale = useLocale();

  if (events.length === 0) return null;
  return (
    <section aria-label={t('title')} className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('title')}</h3>
      <ol className="space-y-1.5 border-s border-border ps-3">
        {events.map((event) => (
          <li key={event.id} className="text-xs">
            <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-foreground">
              {event.fromStatus ? (
                <>
                  <span>{statusLabel(event.fromStatus)}</span>
                  <ArrowRight size={11} aria-hidden="true" className="text-muted-foreground rtl:rotate-180" />
                  <span className="sr-only">{t('to')}</span>
                </>
              ) : (
                <span className="font-normal text-muted-foreground">{t('created')}</span>
              )}
              <span>{statusLabel(event.toStatus)}</span>
            </p>
            <p className="text-muted-foreground">
              {formatAdminDate(event.createdAt, locale, 'shortTime')} ·{' '}
              <span dir="auto">{statusEventActor(event) ?? t('system')}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
