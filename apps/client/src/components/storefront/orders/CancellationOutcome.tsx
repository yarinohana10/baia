'use client';

import { useTranslations } from 'next-intl';
import type { CustomerCancellationRequest } from '@/lib/orders';
import { money } from './money';

/** After a cancellation: the refund (and any fee), or that the store declined the request. */
export function CancellationOutcome({
  requests,
  closed,
}: {
  requests: CustomerCancellationRequest[];
  closed: boolean;
}) {
  const tPage = useTranslations('orderPage');
  const resolved = requests.find((r) => r.status === 'APPROVED' || r.status === 'AUTO_CANCELLED');
  const rejected = !closed && requests.some((r) => r.status === 'REJECTED');
  return (
    <>
      {resolved && (
        <div className="border-t border-gray-100 pt-4 text-sm text-gray-600">
          {resolved.refundAmount
            ? tPage('refunded', { amount: money(resolved.refundAmount) })
            : tPage('cancelledNoRefund')}
          {Number(resolved.feeAmount) > 0 && <span> {tPage('feeCharged', { amount: money(resolved.feeAmount) })}</span>}
        </div>
      )}
      {rejected && <p className="border-t border-gray-100 pt-4 text-sm text-gray-600">{tPage('requestRejected')}</p>}
    </>
  );
}
