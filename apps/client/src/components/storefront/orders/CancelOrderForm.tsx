'use client';

import { useId, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info } from 'lucide-react';
import { PHONE_PATTERN } from '@baia/shared';
import { invalidProps } from '@/lib/form-errors';
import type { CancellationReason } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/forms/FieldError';
import { useCancelOrderForm } from '@/hooks/storefront/useCancelOrderForm';
import { cancelsInstantly, type CancelOrderFields } from '@/hooks/storefront/cancelOrderFormState';
import { CancelOrderResult } from './CancelOrderResult';
import { ReasonOptions } from './ReasonOptions';
import { SelfCancelNotice } from './SelfCancelNotice';
import { lookupFieldClass, lookupLabelClass } from './styles';

/**
 * Public cancellation form. Step 1 checks the order (number + email); an order
 * that has not shipped is cancelled instantly once confirmed, a shipped one gets
 * a request (with the contact phone). Both go through POST /cancellations.
 */
export function CancelOrderForm() {
  const t = useTranslations('cancelOrderPage');
  const tCancel = useTranslations('cancellation');
  const tErrors = useTranslations('checkout.errors');
  const id = useId();
  const { state, dispatch, submitting, submit } = useCancelOrderForm();
  const { fields, issues, found, error, result } = state;

  if (result) return <CancelOrderResult result={result} />;

  const instant = cancelsInstantly(state);
  const errorId = (field: string) => `${id}-${field}-error`;
  const edit = (field: Exclude<keyof CancelOrderFields, 'reason'>) => (e: { target: { value: string } }) =>
    dispatch({ type: 'edit', field, value: e.target.value });
  let submitLabel = t('continue');
  if (found) submitLabel = instant ? tCancel('confirmCancel') : tCancel('sendRequest');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={lookupLabelClass}>
          {t('orderNumber')}
          <input
            required
            maxLength={40}
            dir="ltr"
            autoComplete="off"
            placeholder="BA-XXXXXXXX-XXXXXX"
            value={fields.orderNumber}
            disabled={!!found}
            onChange={edit('orderNumber')}
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
            value={fields.email}
            disabled={!!found}
            onChange={edit('email')}
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
          value={fields.phone}
          onChange={edit('phone')}
          {...invalidProps(issues, 'contactPhone', errorId('contactPhone'))}
          className={lookupFieldClass}
        />
        <FieldError id={errorId('contactPhone')} issue={issues.contactPhone} />
      </label>
      <label className={lookupLabelClass}>
        {tCancel('reason')}
        <select
          required
          value={fields.reason}
          onChange={(e) => dispatch({ type: 'edit', field: 'reason', value: e.target.value as CancellationReason })}
          {...invalidProps(issues, 'reason', errorId('reason'))}
          className={lookupFieldClass}
        >
          <ReasonOptions />
        </select>
        <FieldError id={errorId('reason')} issue={issues.reason} />
      </label>
      <label className={lookupLabelClass}>
        {tCancel('details')}
        <textarea
          rows={4}
          maxLength={1000}
          value={fields.details}
          onChange={edit('details')}
          {...invalidProps(issues, 'details', errorId('details'))}
          className={lookupFieldClass}
        />
        <FieldError id={errorId('details')} issue={issues.details} />
      </label>

      {found && (
        <div className="rounded-xl border border-ocean-200 bg-ocean-50/50 p-4">
          <SelfCancelNotice unpaid={found.order.status === 'PENDING_PAYMENT'} className="text-gray-700" />
        </div>
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
          disabled={submitting || !fields.reason}
          aria-busy={submitting}
          className={cn(
            'rounded-lg px-8 py-3 text-sm tracking-wider text-white transition-colors disabled:opacity-40',
            instant ? 'bg-red-600 hover:bg-red-700' : 'bg-ocean-700 hover:bg-ocean-800',
          )}
        >
          {submitting ? tCancel('sending') : submitLabel}
        </button>
        {found && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'startOver' })}
            className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            {t('startOver')}
          </button>
        )}
      </div>
    </form>
  );
}
