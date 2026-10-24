'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { CustomerOrder } from '@/lib/orders';
import type { OrderPhase } from './order-view';

/** Icon, "thank you" / "your order" title and the status line. */
export function OrderHeading({
  order,
  phase,
  statusLabel,
}: {
  order: CustomerOrder;
  phase: OrderPhase;
  statusLabel: string;
}) {
  const t = useTranslations('orderConfirmation');
  const tPage = useTranslations('orderPage');
  const { closed, pending, justPlaced } = phase;

  let icon = <CheckCircle2 size={56} className="mx-auto text-green-500 mb-5" />;
  if (closed) icon = <XCircle size={56} className="mx-auto text-gray-400 mb-5" />;
  else if (pending) icon = <Clock size={56} className="mx-auto text-amber-500 mb-5" />;

  let statusLine = tPage('statusLine', { status: statusLabel });
  if (closed) statusLine = statusLabel;
  else if (pending) statusLine = t('pending');
  else if (justPlaced) statusLine = t('placed');

  return (
    <div className="text-center">
      {icon}
      <h1 className="mb-2 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{justPlaced ? t('thankYou') : tPage('title')}</h1>
      <p className="text-gray-500 mb-2">{statusLine}</p>
      {!closed && <p className="text-sm text-gray-400 mb-8">{tPage('emailSentTo', { email: order.customerEmail })}</p>}
    </div>
  );
}
