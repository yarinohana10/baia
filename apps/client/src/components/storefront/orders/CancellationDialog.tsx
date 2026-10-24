'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, X } from 'lucide-react';
import { PHONE_PATTERN } from '@/lib/addresses';
import type { CancellationReason, CustomerOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { useModalDialog } from '@/hooks/storefront/useModalDialog';
import { useCancellationSubmit, type CancellationMode } from '@/hooks/storefront/useCancellationSubmit';
import { ReasonOptions } from './ReasonOptions';
import { dialogFieldClass, dialogLabelClass } from './styles';

/** Translation keys (under `cancellation`) for each dialog mode. */
function dialogCopy(mode: CancellationMode, unpaid: boolean) {
  if (mode === 'request') return { title: 'dialogRequestTitle', body: 'dialogRequestBody', submit: 'sendRequest' };
  return { title: 'dialogCancelTitle', body: unpaid ? 'dialogCancelUnpaid' : 'dialogCancelBody', submit: 'confirmCancel' };
}

/**
 * Modal form for cancelling an order (or asking the store to): reason,
 * details and, for a request, a contact phone. Calls `onDone` with the
 * server's fresh order.
 */
export function CancellationDialog({
  mode,
  order,
  token,
  onClose,
  onDone,
}: {
  mode: CancellationMode;
  order: CustomerOrder;
  token?: string | null;
  onClose: () => void;
  onDone: (order: CustomerOrder) => void;
}) {
  const t = useTranslations('cancellation');
  const tErrors = useTranslations('checkout.errors');
  const titleId = useId();
  const dialog = useModalDialog(onClose);
  const { submitting, error, submit } = useCancellationSubmit({ orderId: order.id, mode, token, onDone });
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState(order.phone ?? '');
  const isRequest = mode === 'request';
  const copy = dialogCopy(mode, order.status === 'PENDING_PAYMENT');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason || submitting) return;
    void submit({ reason, details, phone });
  };

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-black/30 p-4 text-inherit backdrop:bg-transparent open:flex"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-none bg-white p-6 text-start shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {t(copy.title)}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-none p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">{t(copy.body, { number: order.orderNumber })}</p>

          {isRequest && order.cancellation?.requiresReturn && (
            <p className="flex items-start gap-2 rounded-none bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t('returnNotice')}
            </p>
          )}

          <div>
            <label htmlFor={`${titleId}-reason`} className={dialogLabelClass}>
              {t('reason')}
            </label>
            <select
              id={`${titleId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              className={dialogFieldClass}
              required
            >
              <ReasonOptions />
            </select>
          </div>

          <div>
            <label htmlFor={`${titleId}-details`} className={dialogLabelClass}>
              {t('details')}
            </label>
            <textarea
              id={`${titleId}-details`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className={dialogFieldClass}
            />
          </div>

          {isRequest && (
            <div>
              <label htmlFor={`${titleId}-phone`} className={dialogLabelClass}>
                {t('phone')}
              </label>
              <input
                id={`${titleId}-phone`}
                type="tel"
                inputMode="tel"
                dir="ltr"
                required
                pattern={PHONE_PATTERN}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={dialogFieldClass}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-none bg-red-50 px-3 py-2 text-sm text-red-600">
              {tErrors(error.key, error.values)}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-none border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('keepOrder')}
            </button>
            <button
              type="submit"
              disabled={!reason || submitting}
              aria-busy={submitting}
              className={cn(
                'rounded-none px-4 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                isRequest ? 'bg-black hover:bg-neutral-800' : 'bg-red-600 hover:bg-red-700',
              )}
            >
              {submitting ? t('sending') : t(copy.submit)}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
