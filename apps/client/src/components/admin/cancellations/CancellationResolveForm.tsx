'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatShekels as money } from '@/components/admin/order-status';
import { parseFee, type AdminCancellation, type ResolveAction } from './types';

/** Fee, note and approve / reject for an open request. */
export function CancellationResolveForm({
  request,
  onResolved,
}: {
  request: AdminCancellation;
  onResolved: (text: string, kind: 'success' | 'error') => void;
}) {
  const t = useTranslations('admin.cancellations');
  const [fee, setFee] = useState(String(request.suggestedFee));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ResolveAction | null>(null);
  // Set once the API accepted the action; the list reload then replaces this form.
  const [done, setDone] = useState<ResolveAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { order } = request;
  const total = parseFloat(order.total);
  const feeValue = parseFee(fee, total);
  const feeValid = feeValue !== null;
  const pending = busy ?? done;

  const confirmQuestion = (action: ResolveAction) => {
    if (action === 'reject') return t('confirmReject', { number: order.orderNumber });
    return order.paid
      ? t('confirmApprove', { refund: money(Math.max(0, total - (feeValue ?? 0))), number: order.orderNumber })
      : t('confirmApproveUnpaid', { number: order.orderNumber });
  };

  const resolve = async (action: ResolveAction) => {
    if (pending || (action === 'approve' && !feeValid)) return;
    if (!window.confirm(confirmQuestion(action))) return;
    setBusy(action);
    setError(null);
    try {
      const res = await api.put(`/admin/cancellations/${request.id}`, {
        action,
        feeAmount: action === 'approve' && feeValue !== null ? Math.round(feeValue * 100) / 100 : undefined,
        adminNote: note.trim() || undefined,
      });
      setDone(action);
      if (action === 'approve' && res.data?.refundFailed) {
        onResolved(t('approvedRefundFailed', { number: order.orderNumber }), 'error');
      } else {
        onResolved(t(action === 'approve' ? 'approved' : 'rejected', { number: order.orderNumber }), 'success');
      }
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setError(status === 409 ? t('alreadyHandled') : t('actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="space-y-1.5">
        <Label htmlFor={`fee-${request.id}`}>{t('fee')}</Label>
        <Input
          id={`fee-${request.id}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={total}
          step="0.01"
          dir="ltr"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          aria-invalid={!feeValid}
        />
        <p className="text-xs text-muted-foreground">
          {request.insideWindow ? t('feeHintInside') : t('feeHintOutside', { amount: money(request.suggestedFee) })}
        </p>
        {order.paid && feeValue !== null && (
          <p className="text-xs text-foreground">{t('refundPreview', { amount: money(Math.max(0, total - feeValue)) })}</p>
        )}
        {order.paid && !order.hasPaymentRef && <p className="text-xs text-amber-700">{t('manualRefund')}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`note-${request.id}`}>{t('note')}</Label>
        <Textarea
          id={`note-${request.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t('notePlaceholder')}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button
          type="button"
          onClick={() => resolve('approve')}
          disabled={!!pending || !feeValid}
          className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800"
        >
          <Check size={14} /> {pending === 'approve' ? t('working') : t('approve')}
        </Button>
        <Button type="button" variant="outline" onClick={() => resolve('reject')} disabled={!!pending} className="gap-1.5">
          <X size={14} /> {pending === 'reject' ? t('working') : t('reject')}
        </Button>
      </div>
    </div>
  );
}
