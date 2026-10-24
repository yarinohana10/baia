'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { orderPageHref } from '@/lib/orders';
import { orderLookupSchema } from '@baia/shared';
import { clearIssue, invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';
import { useBusyAction } from '@/hooks/storefront/useBusyAction';
import { lookupFieldClass, lookupLabelClass } from './styles';

/**
 * Order number + email → POST /orders/lookup → the order page, carrying the
 * signed access token in the URL fragment (exchanged there for the scoped cookie).
 */
export function OrderLookupForm() {
  const t = useTranslations('orderStatusPage');
  const tErrors = useTranslations('checkout.errors');
  const locale = useLocale();
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, runSubmit] = useBusyAction();
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [issues, setIssues] = useState<FieldIssues>({});
  const id = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const check = validateForm(orderLookupSchema, { orderNumber, email });
    setIssues(check.errors);
    if (!check.success) return;
    setError(null);
    await runSubmit(async () => {
      try {
        const res = await api.post('/orders/lookup', check.data);
        router.push(orderPageHref(res.data.order.id, res.data.accessToken));
        return 'navigating';
      } catch (err) {
        setError(shopErrorMessage(err, locale));
        return 'done';
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className={lookupLabelClass}>
        {t('orderNumber')}
        <input
          name="orderNumber"
          required
          maxLength={40}
          dir="ltr"
          autoComplete="off"
          placeholder="BA-XXXXXXXX-XXXXXX"
          value={orderNumber}
          onChange={(e) => {
            setOrderNumber(e.target.value);
            setIssues((v) => clearIssue(v, 'orderNumber'));
          }}
          {...invalidProps(issues, 'orderNumber', `${id}-orderNumber-error`)}
          className={`${lookupFieldClass} font-mono uppercase`}
        />
        <FieldError id={`${id}-orderNumber-error`} issue={issues.orderNumber} />
      </label>
      <label className={lookupLabelClass}>
        {t('email')}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setIssues((v) => clearIssue(v, 'email'));
          }}
          {...invalidProps(issues, 'email', `${id}-email-error`)}
          className={lookupFieldClass}
        />
        <FieldError id={`${id}-email-error`} issue={issues.email} />
      </label>
      {error && (
        <p role="alert" className="rounded-none bg-red-50 px-4 py-3 text-sm text-red-600">
          {tErrors(error.key, error.values)}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-none bg-black py-3 text-sm tracking-wider text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 sm:w-auto sm:px-10"
      >
        <Search size={15} aria-hidden="true" />
        {submitting ? t('searching') : t('submit')}
      </button>
      <p className="text-xs text-gray-500">{t('hint')}</p>
    </form>
  );
}
