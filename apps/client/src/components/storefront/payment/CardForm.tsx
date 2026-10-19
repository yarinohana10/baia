'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { cardMaxLength, detectCardBrand, type PaymentConfig, type PayRequest } from '@/lib/payment';
import { cardCvvLength } from '@/hooks/storefront/cardFormState';
import { useCardForm } from '@/hooks/storefront/useCardForm';
import { BusyIcon } from './BusyIcon';
import { InstallmentsField } from './InstallmentsField';
import { TestCards } from './TestCards';
import { TextField } from './TextField';
import { ThreeDsChallenge } from './ThreeDsChallenge';
import { payButtonClass, paymentInputClasses } from './styles';

type CardFormProps = {
  total: number;
  amount: string;
  config: PaymentConfig;
  busy: boolean;
  onPay: (body: PayRequest) => void;
};

/**
 * Credit card form. Number, expiry, CVV and ID are validated here and never
 * sent anywhere: `onPay` receives only `cardPayRequest(...)`.
 */
export function CardForm({ total, amount, config, busy, onPay }: CardFormProps) {
  const t = useTranslations('payment');
  const form = useCardForm({ total, config, busy, onPay });
  const { state, shown, inputProps } = form;
  const brand = detectCardBrand(state.values.number);
  const cvvLen = cardCvvLength(state.values.number);
  // Test mode: discourage the browser from offering a real saved card.
  const cardAutoComplete = (token: string) => (config.testMode ? 'off' : token);

  if (state.challenge) {
    return (
      <ThreeDsChallenge
        amount={amount}
        busy={busy}
        testMode={config.testMode}
        onCancel={() => form.dispatch({ type: 'challenge', open: false })}
        onVerified={form.verified}
      />
    );
  }

  return (
    <form onSubmit={form.submit} noValidate className="space-y-4">
      <TextField
        id={form.inputId('number')}
        label={t('card.number')}
        error={shown('number')}
        adornment={
          brand && (
            <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {t('card.brand', { brand })}
            </span>
          )
        }
      >
        <input
          {...inputProps('number')}
          name="cardnumber"
          dir="ltr"
          inputMode="numeric"
          autoComplete={cardAutoComplete('cc-number')}
          placeholder="0000 0000 0000 0000"
          maxLength={cardMaxLength(brand) + 4}
          className={paymentInputClasses(!!shown('number'), 'font-mono text-left pe-28')}
        />
      </TextField>

      <div className="grid grid-cols-2 gap-3">
        <TextField id={form.inputId('expiry')} label={t('card.expiry')} error={shown('expiry')}>
          <input
            {...inputProps('expiry')}
            dir="ltr"
            inputMode="numeric"
            autoComplete={cardAutoComplete('cc-exp')}
            placeholder={t('card.expiryPlaceholder')}
            maxLength={5}
            className={paymentInputClasses(!!shown('expiry'), 'font-mono text-left')}
          />
        </TextField>
        <TextField id={form.inputId('cvv')} label={t('card.cvv')} error={shown('cvv')} hint={t('card.cvvHint')}>
          <input
            {...inputProps('cvv', true)}
            dir="ltr"
            inputMode="numeric"
            type="password"
            autoComplete={cardAutoComplete('cc-csc')}
            placeholder={'•'.repeat(cvvLen)}
            maxLength={cvvLen}
            className={paymentInputClasses(!!shown('cvv'), 'font-mono text-left')}
          />
        </TextField>
      </div>

      <TextField id={form.inputId('holderId')} label={t('card.holderId')} error={shown('holderId')}>
        <input
          {...inputProps('holderId')}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          className={paymentInputClasses(!!shown('holderId'), 'font-mono text-left')}
        />
      </TextField>

      <InstallmentsField
        id={form.inputId('installments')}
        total={total}
        config={config}
        value={state.installments}
        busy={busy}
        onChange={(count) => form.dispatch({ type: 'installments', count })}
      />

      {state.submitted && form.hasErrors && (
        <p className="text-xs text-red-600" role="status">
          {t('errors.fixFields')}
        </p>
      )}

      <button type="submit" disabled={busy} aria-busy={busy} className={payButtonClass}>
        <BusyIcon busy={busy} icon={<ShieldCheck size={16} aria-hidden="true" />} />
        {busy ? t('processing') : t('pay', { amount })}
      </button>

      {config.testMode && <TestCards onUse={form.fillTestCard} disabled={busy} />}
    </form>
  );
}
