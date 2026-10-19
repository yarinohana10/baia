'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { PHONE_PATTERN, publicCancellationSchema, type PublicCancellationPayload } from '@baia/shared';
import { clearIssue, invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { CANCELLATION_REASONS, orderPageHref, type CancellationReason, type CustomerOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { formatDeadline } from './OrderCancellation';
import { lookupFieldClass, lookupLabelClass } from './OrderLookupForm';

type Found = { order: CustomerOrder; accessToken: string };
type Result = { outcome: 'CANCELLED' | 'REQUESTED'; order: CustomerOrder; accessToken: string };

/**
 * Public cancellation form. Step 1 checks the order (number + email); inside
 * the free window the shopper may cancel instantly or ask us to call first,
 * otherwise a request is filed. Both go through POST /cancellations.
 */
export function CancelOrderForm() {
  const t = useTranslations('cancelOrderPage');
  const tCancel = useTranslations('cancellation');
  const tErrors = useTranslations('checkout.errors');
  const locale = useLocale();

  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [details, setDetails] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [instant, setInstant] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [issues, setIssues] = useState<FieldIssues>({});
  const id = useId();

  const send = async (payload: PublicCancellationPayload, useInstant: boolean) => {
    const res = await api.post<Result>('/cancellations', { ...payload, instant: useInstant });
    setResult(res.data);
  };

  const errorId = (field: string) => `${id}-${field}-error`;
  const edited = (field: string) => setIssues((v) => clearIssue(v, field));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !reason) return;
    const check = validateForm(publicCancellationSchema, { orderNumber, email, reason, details, contactPhone: phone });
    setIssues(check.errors);
    if (!check.success) return;
    const payload = check.data;
    setSubmitting(true);
    setError(null);
    try {
      if (found) {
        await send(
          payload,
          found.order.cancellation?.canSelfCancel === true && (instant || !found.order.cancellation.canRequest),
        );
      } else {
        const res = await api.post<Found>('/orders/lookup', { orderNumber: payload.orderNumber, email: payload.email });
        const info = res.data.order.cancellation;
        if (info?.canSelfCancel) {
          // Let the shopper choose (or confirm) before anything happens.
          setFound(res.data);
        } else if (info?.openRequest) {
          setError({ key: 'cancellationAlreadyRequested' });
        } else if (!info?.canRequest) {
          setError({ key: 'cancellationNotAllowed' });
        } else {
          await send(payload, false);
        }
      }
    } catch (err) {
      setError(shopErrorMessage(err, locale));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div role="status" className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6">
        <p className="flex items-center gap-2 text-lg font-semibold text-green-800">
          <CheckCircle2 size={22} aria-hidden="true" />
          {result.outcome === 'CANCELLED' ? t('doneCancelledTitle') : t('doneRequestedTitle')}
        </p>
        <p className="text-sm text-green-900">
          {result.outcome === 'CANCELLED'
            ? result.order.paidAt
              ? t('doneCancelledBody')
              : t('doneCancelledUnpaidBody')
            : t('doneRequestedBody')}
        </p>
        <Link
          href={orderPageHref(result.order.id, result.accessToken)}
          className="inline-block rounded-lg bg-ocean-700 px-6 py-2.5 text-sm text-white hover:bg-ocean-800"
        >
          {t('viewOrder')}
        </Link>
      </div>
    );
  }

  const info = found?.order.cancellation;
  const unpaid = found?.order.status === 'PENDING_PAYMENT';

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={lookupLabelClass}>
          {t('orderNumber')}
          <input
            required
            maxLength={40}
            dir="ltr"
            autoComplete="off"
            placeholder="BA-XXXXXXXX-XXXXXX"
            value={orderNumber}
            disabled={!!found}
            onChange={(e) => {
              setOrderNumber(e.target.value);
              edited('orderNumber');
            }}
            {...invalidProps(issues, 'orderNumber', errorId('orderNumber'))}
            className={`${lookupFieldClass} font-mono uppercase disabled:bg-gray-50`}
          />
          <FieldError id={errorId('orderNumber')} issue={issues.orderNumber} />
        </label>
        <label className={lookupLabelClass}>
          {t('email')}
          <input
            type="email"
            required
            maxLength={254}
            dir="ltr"
            autoComplete="email"
            value={email}
            disabled={!!found}
            onChange={(e) => {
              setEmail(e.target.value);
              edited('email');
            }}
            {...invalidProps(issues, 'email', errorId('email'))}
            className={`${lookupFieldClass} disabled:bg-gray-50`}
          />
          <FieldError id={errorId('email')} issue={issues.email} />
        </label>
      </div>
      <label className={lookupLabelClass}>
        {t('phone')}
        <input
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          pattern={PHONE_PATTERN}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            edited('contactPhone');
          }}
          {...invalidProps(issues, 'contactPhone', errorId('contactPhone'))}
          className={lookupFieldClass}
        />
        <FieldError id={errorId('contactPhone')} issue={issues.contactPhone} />
      </label>
      <label className={lookupLabelClass}>
        {tCancel('reason')}
        <select
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value as CancellationReason);
            edited('reason');
          }}
          {...invalidProps(issues, 'reason', errorId('reason'))}
          className={lookupFieldClass}
        >
          <option value="" disabled>
            {tCancel('reasonPlaceholder')}
          </option>
          {CANCELLATION_REASONS.map((r) => (
            <option key={r} value={r}>
              {tCancel(`reasons.${r}`)}
            </option>
          ))}
        </select>
        <FieldError id={errorId('reason')} issue={issues.reason} />
      </label>
      <label className={lookupLabelClass}>
        {tCancel('details')}
        <textarea
          rows={4}
          maxLength={1000}
          value={details}
          onChange={(e) => {
            setDetails(e.target.value);
            edited('details');
          }}
          {...invalidProps(issues, 'details', errorId('details'))}
          className={lookupFieldClass}
        />
        <FieldError id={errorId('details')} issue={issues.details} />
      </label>

      {found && info && (
        <fieldset className="space-y-3 rounded-xl border border-ocean-200 bg-ocean-50/50 p-4">
          <legend className="sr-only">{t('chooseLegend')}</legend>
          <p className="flex items-start gap-2 text-sm text-gray-700">
            <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <span>
              {unpaid
                ? tCancel('unpaidCanCancel')
                : info.selfCancelDeadline
                  ? tCancel('freeUntil', { deadline: formatDeadline(info.selfCancelDeadline, locale) })
                  : tCancel('freeNow')}
            </span>
          </p>
          {info.canRequest ? (
            <div className="space-y-2">
              {[true, false].map((value) => (
                <label
                  key={String(value)}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-sm',
                    instant === value ? 'border-ocean-600' : 'border-gray-200',
                  )}
                >
                  <input
                    type="radio"
                    name="cancel-mode"
                    checked={instant === value}
                    onChange={() => setInstant(value)}
                    className="mt-1 accent-ocean-700"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{value ? t('instantTitle') : t('requestTitle')}</span>
                    <span className="block text-xs text-gray-500">{value ? t('instantBody') : t('requestBody')}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
      )}

      {!found && (
        <p className="flex items-start gap-2 text-xs text-gray-500">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t('formHint')}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {tErrors(error.key, error.values)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !reason}
          aria-busy={submitting}
          className={cn(
            'rounded-lg px-8 py-3 text-sm tracking-wider text-white transition-colors disabled:opacity-40',
            found && (instant || !info?.canRequest) ? 'bg-red-600 hover:bg-red-700' : 'bg-ocean-700 hover:bg-ocean-800',
          )}
        >
          {submitting
            ? tCancel('sending')
            : !found
              ? t('continue')
              : instant || !info?.canRequest
                ? tCancel('confirmCancel')
                : tCancel('sendRequest')}
        </button>
        {found && (
          <button
            type="button"
            onClick={() => {
              setFound(null);
              setError(null);
            }}
            className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            {t('startOver')}
          </button>
        )}
      </div>
    </form>
  );
}
