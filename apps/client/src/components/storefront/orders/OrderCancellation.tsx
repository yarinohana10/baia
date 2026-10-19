'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CalendarClock, CheckCircle2, Info, X } from 'lucide-react';
import { api } from '@/lib/api';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { PHONE_PATTERN } from '@/lib/addresses';
import { CANCELLATION_REASONS, type CancellationReason, type CustomerOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';

/** Built once, in the store's time zone, so server and browser render the same date. */
const REQUEST_DATE_FORMAT = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' }),
  en: new Intl.DateTimeFormat('en-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' }),
};

type Mode = 'cancel' | 'request';

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-medium text-gray-500';

/** "Sun 14:30, 3.6" style deadline in the shopper's locale. */
export function formatDeadline(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // The 48-hour window is the store's clock, so show it in Israel time.
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));
}

/**
 * Cancellation actions for an order the viewer owns (session or guest
 * cookie/token): an instant free cancel inside the window, otherwise a
 * request the store reviews. Calls `onUpdated` with the server's fresh order.
 */
export function OrderCancellation({
  order,
  token,
  onUpdated,
  compact = false,
}: {
  order: CustomerOrder;
  /** Guest token kept in memory on the order page (the cookie also works). */
  token?: string | null;
  onUpdated: (order: CustomerOrder) => void;
  compact?: boolean;
}) {
  const t = useTranslations('cancellation');
  const tErrors = useTranslations('checkout.errors');
  const locale = useLocale();
  const [mode, setMode] = useState<Mode | null>(null);
  const [done, setDone] = useState<Mode | null>(null);
  const info = order.cancellation;

  if (!info) return null;
  const { canSelfCancel, canRequest, openRequest, selfCancelDeadline, requiresReturn } = info;
  const unpaid = order.status === 'PENDING_PAYMENT';

  if (done) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{done === 'cancel' ? (unpaid ? t('cancelledUnpaid') : t('cancelledDone')) : t('requestDone')}</span>
      </div>
    );
  }

  if (openRequest) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          {t('openRequest', {
            date: REQUEST_DATE_FORMAT[locale === 'he' ? 'he' : 'en'].format(new Date(openRequest.createdAt)),
          })}
        </span>
      </div>
    );
  }

  if (!canSelfCancel && !canRequest) return null;

  return (
    <div className={cn('space-y-3', !compact && 'rounded-xl border border-gray-200 bg-white p-5 text-start')}>
      {!compact && <h2 className="text-sm font-medium text-gray-900">{t('title')}</h2>}

      {canSelfCancel ? (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
          <span>
            {unpaid
              ? t('unpaidCanCancel')
              : selfCancelDeadline
                ? t('freeUntil', { deadline: formatDeadline(selfCancelDeadline, locale) })
                : t('freeNow')}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gray-400" />
          <span>{requiresReturn ? t('requestShipped') : t('requestAfterWindow', { hours: info.windowHours })}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {canSelfCancel && (
          <button
            type="button"
            onClick={() => setMode('cancel')}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            {t('cancelButton')}
          </button>
        )}
        {canRequest && (
          <button
            type="button"
            onClick={() => setMode('request')}
            className={cn(
              canSelfCancel
                ? 'text-xs text-gray-500 underline underline-offset-2 hover:text-ocean-700'
                : 'rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50',
            )}
          >
            {canSelfCancel ? t('preferTalk') : t('requestButton')}
          </button>
        )}
      </div>

      {mode && (
        <CancellationDialog
          mode={mode}
          order={order}
          token={token}
          onClose={() => setMode(null)}
          onDone={(updated) => {
            setDone(mode);
            setMode(null);
            onUpdated(updated);
          }}
          errorText={(e) => tErrors(e.key, e.values)}
        />
      )}
    </div>
  );
}

function CancellationDialog({
  mode,
  order,
  token,
  onClose,
  onDone,
  errorText,
}: {
  mode: Mode;
  order: CustomerOrder;
  token?: string | null;
  onClose: () => void;
  onDone: (order: CustomerOrder) => void;
  errorText: (e: ErrorMessage) => string;
}) {
  const t = useTranslations('cancellation');
  const locale = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState(order.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const requiresReturn = order.cancellation?.requiresReturn ?? false;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('select, textarea, input, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Keep Tab inside the dialog while it is open.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button, select, textarea, input, a[href]'),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    const headers = token ? { 'X-Order-Token': token } : undefined;
    const id = encodeURIComponent(order.id);
    try {
      const res =
        mode === 'cancel'
          ? await api.post(`/orders/${id}/cancel`, { reason, details: details || undefined }, { headers })
          : await api.post(
              `/orders/${id}/cancellation-request`,
              { reason, details: details || undefined, contactPhone: phone.trim() || undefined },
              { headers },
            );
      onDone(res.data);
    } catch (err) {
      setError(shopErrorMessage(err, locale));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 text-start shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {mode === 'cancel' ? t('dialogCancelTitle') : t('dialogRequestTitle')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-full p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">
            {mode === 'cancel'
              ? order.status === 'PENDING_PAYMENT'
                ? t('dialogCancelUnpaid', { number: order.orderNumber })
                : t('dialogCancelBody', { number: order.orderNumber })
              : t('dialogRequestBody', { number: order.orderNumber })}
          </p>

          {mode === 'request' && requiresReturn && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t('returnNotice')}
            </p>
          )}

          <div>
            <label htmlFor={`${titleId}-reason`} className={labelClass}>
              {t('reason')}
            </label>
            <select
              id={`${titleId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              className={fieldClass}
              required
            >
              <option value="" disabled>
                {t('reasonPlaceholder')}
              </option>
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${titleId}-details`} className={labelClass}>
              {t('details')}
            </label>
            <textarea
              id={`${titleId}-details`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className={fieldClass}
            />
          </div>

          {mode === 'request' && (
            <div>
              <label htmlFor={`${titleId}-phone`} className={labelClass}>
                {t('phone')}
              </label>
              <input
                id={`${titleId}-phone`}
                type="tel"
                inputMode="tel"
                dir="ltr"
                pattern={PHONE_PATTERN}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldClass}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorText(error)}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('keepOrder')}
            </button>
            <button
              type="submit"
              disabled={!reason || submitting}
              aria-busy={submitting}
              className={cn(
                'rounded-lg px-4 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                mode === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-ocean-700 hover:bg-ocean-800',
              )}
            >
              {submitting ? t('sending') : mode === 'cancel' ? t('confirmCancel') : t('sendRequest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
