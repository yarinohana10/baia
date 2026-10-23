'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatShekels as money } from '@/components/admin/order-status';
import { OrderModal } from './OrderModal';

/**
 * Confirms a Refund Pending: the admin refunds in the payment provider's dashboard first,
 * then confirms here (provider reference and note are optional). A pending refund can
 * also be marked as failed (the order stays cancelled).
 */
export function RefundCompleteDialog({
  orderNumber,
  amount,
  canFail,
  onComplete,
  onFail,
  onClose,
}: {
  orderNumber: string;
  amount: string;
  canFail: boolean;
  /** Each resolves to an error message, or null once it went through. */
  onComplete: (input: { providerRef: string; note: string }) => Promise<string | null>;
  onFail: (note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useTranslations('admin.orderCards.refund');
  const id = useId();
  const [providerRef, setProviderRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'complete' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'complete' | 'fail') => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    const failure = await (kind === 'complete' ? onComplete({ providerRef, note }) : onFail(note));
    setBusy(null);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <OrderModal
      title={t('dialogTitle', { number: orderNumber })}
      description={t('dialogBody', { amount: money(amount) })}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('dialogSteps')}</p>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-ref`}>{t('providerRef')}</Label>
          <Input
            id={`${id}-ref`}
            type="text"
            dir="ltr"
            maxLength={200}
            value={providerRef}
            onChange={(e) => setProviderRef(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`}>{t('note')}</Label>
          <Textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {canFail && (
            <Button type="button" variant="outline" onClick={() => run('fail')} disabled={!!busy}>
              {busy === 'fail' ? t('working') : t('markFailed')}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => run('complete')}
            disabled={!!busy}
            className="bg-ocean-700 text-white hover:bg-ocean-800"
          >
            {busy === 'complete' ? t('working') : t('confirmDone')}
          </Button>
        </div>
      </div>
    </OrderModal>
  );
}
