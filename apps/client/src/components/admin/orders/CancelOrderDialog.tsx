'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatShekels as money } from '@/components/admin/order-status';
import { parseCancelFee } from '@/hooks/admin/order-actions';
import { OrderModal } from './OrderModal';
import { isPaidStatus } from './order-utils';
import type { AdminOrder } from './types';

/**
 * Cancels an order: returns the items to stock, emails the customer and, for a paid
 * order, optionally refunds it (minus an optional cancellation fee).
 */
export function CancelOrderDialog({
  order,
  onCancel,
  onClose,
}: {
  order: AdminOrder;
  /** Resolves to an error message, or null once the order was cancelled. */
  onCancel: (input: { refund: boolean; fee: number; note: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations('admin.orderCards.cancel');
  const id = useId();
  const paid = isPaidStatus(order.status);
  const total = parseFloat(order.total);
  const [refund, setRefund] = useState(true);
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feeValue = parseCancelFee(fee, total);
  const refunding = paid && refund;

  const submit = async () => {
    if (busy || (refunding && feeValue === null)) return;
    setBusy(true);
    setError(null);
    const failure = await onCancel({ refund: refunding, fee: feeValue ?? 0, note });
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <OrderModal title={t('title', { number: order.orderNumber })} description={t('description')} onClose={onClose}>
      <div className="space-y-4">
        {paid && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refund}
              onChange={(e) => setRefund(e.target.checked)}
              className="accent-ocean-700"
            />
            {t('refund', { amount: money(total) })}
          </label>
        )}
        {refunding && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-fee`}>{t('fee')}</Label>
            <Input
              id={`${id}-fee`}
              type="number"
              inputMode="decimal"
              min={0}
              max={total}
              step="0.01"
              dir="ltr"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0"
              aria-invalid={feeValue === null}
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {feeValue === null ? t('feeInvalid') : t('refundPreview', { amount: money(Math.max(0, total - feeValue)) })}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>{t('note')}</Label>
          <Textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
        </div>
        {refunding && <p className="text-xs text-muted-foreground">{t('providerHint')}</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('keep')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={busy || (refunding && feeValue === null)}
          >
            {busy ? t('working') : refunding ? t('confirmRefund') : t('confirm')}
          </Button>
        </div>
      </div>
    </OrderModal>
  );
}
