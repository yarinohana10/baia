'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { orderPageHref } from '@/lib/orders';
import type { CancellationResult } from '@/hooks/storefront/cancelOrderFormState';

/** Final step of the public cancellation form: cancelled or request filed. */
export function CancelOrderResult({ result }: { result: CancellationResult }) {
  const t = useTranslations('cancelOrderPage');
  const cancelled = result.outcome === 'CANCELLED';
  let body = t('doneRequestedBody');
  if (cancelled) body = result.order.paidAt ? t('doneCancelledBody') : t('doneCancelledUnpaidBody');
  return (
    <div role="status" className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6">
      <p className="flex items-center gap-2 text-lg font-semibold text-green-800">
        <CheckCircle2 size={22} aria-hidden="true" />
        {cancelled ? t('doneCancelledTitle') : t('doneRequestedTitle')}
      </p>
      <p className="text-sm text-green-900">{body}</p>
      <Link
        href={orderPageHref(result.order.id, result.accessToken)}
        className="inline-block rounded-lg bg-ocean-700 px-6 py-2.5 text-sm text-white hover:bg-ocean-800"
      >
        {t('viewOrder')}
      </Link>
    </div>
  );
}
