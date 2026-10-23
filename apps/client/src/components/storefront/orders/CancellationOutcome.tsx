'use client';

import { useTranslations } from 'next-intl';
import { pendingRefund, type CustomerCancellationRequest, type CustomerRefund } from '@/lib/orders';
import { money } from './money';

/**
 * After a cancellation: where the refund stands (in progress until the
 * provider has returned the money), any fee, or that the store declined a request.
 */
export function CancellationOutcome({
  requests,
  refunds,
  closed,
}: {
  requests: CustomerCancellationRequest[];
  refunds: CustomerRefund[];
  closed: boolean;
}) {
  const tPage = useTranslations('orderPage');
  const resolved = requests.find((r) => r.status === 'APPROVED' || r.status === 'AUTO_CANCELLED');
  const rejected = !closed && requests.some((r) => r.status === 'REJECTED');
  const waiting = pendingRefund({ refunds });
  const done = refunds.find((r) => r.status === 'COMPLETED');
  const refund = waiting ?? done;
  return (
    <>
      {refund && (
        <div role="status" className="border-t border-gray-100 pt-4 text-sm text-gray-600">
          {waiting && <p className="mb-1 font-medium text-gray-900">{tPage('refundPendingTitle')}</p>}
          <p>{tPage(waiting ? 'refundPendingBody' : 'refundDoneBody', { amount: money(refund.amount) })}</p>
          {resolved && Number(resolved.feeAmount) > 0 && (
            <p className="mt-1">{tPage('feeCharged', { amount: money(resolved.feeAmount) })}</p>
          )}
        </div>
      )}
      {!refund && resolved && (
        <div className="border-t border-gray-100 pt-4 text-sm text-gray-600">{tPage('cancelledNoRefund')}</div>
      )}
      {rejected && <p className="border-t border-gray-100 pt-4 text-sm text-gray-600">{tPage('requestRejected')}</p>}
    </>
  );
}
