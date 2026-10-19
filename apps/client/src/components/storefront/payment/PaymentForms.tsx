'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/catalog/pricing';
import {
  TEST_CARDS,
  cardMaxLength,
  cardNumberValid,
  cardPayRequest,
  cvvLength,
  detectCardBrand,
  digitsOnly,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  formatIsraeliMobile,
  installmentOptions,
  israeliIdValid,
  israeliMobileValid,
  simulationForCard,
  type PaymentConfig,
  type PayRequest,
} from '@/lib/payment';
import { cn } from '@/lib/utils';
import { FlaskConical, Loader2, ShieldCheck, Smartphone, Wallet } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:border-ocean-500 focus:outline-none focus:ring-1 focus:ring-ocean-500 disabled:bg-gray-50';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';
const payButtonClass =
  'w-full bg-ocean-700 text-white py-3 text-sm tracking-wide rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

type Field = 'number' | 'expiry' | 'cvv' | 'holderId';
type FieldError = { key: string; values?: Record<string, string | number> } | null;

function TextField({
  id,
  label,
  error,
  hint,
  children,
  adornment,
}: {
  id: string;
  label: string;
  error: string | null;
  hint?: string;
  children: ReactNode;
  adornment?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        {children}
        {adornment && <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">{adornment}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-gray-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Two years ahead, for the test-card filler. */
function futureExpiry(now = new Date()) {
  return `12/${String((now.getFullYear() + 2) % 100).padStart(2, '0')}`;
}

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
  const uid = useId();
  const ids = {
    number: `${uid}-number`,
    expiry: `${uid}-expiry`,
    cvv: `${uid}-cvv`,
    holderId: `${uid}-holder-id`,
    installments: `${uid}-installments`,
  };
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [holderId, setHolderId] = useState('');
  const options = installmentOptions(total, config.installments);
  const [installments, setInstallments] = useState(1);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ number: false, expiry: false, cvv: false, holderId: false });
  const [submitted, setSubmitted] = useState(false);
  const [challenge, setChallenge] = useState(false);

  const brand = detectCardBrand(number);
  const cvvLen = cvvLength(brand);

  const errors: Record<Field, FieldError> = {
    number: !digitsOnly(number) ? { key: 'numberRequired' } : !cardNumberValid(number) ? { key: 'numberInvalid' } : null,
    expiry: !expiry ? { key: 'expiryRequired' } : !expiryValid(expiry) ? { key: 'expiryInvalid' } : null,
    cvv: !new RegExp(`^\\d{${cvvLen}}$`).test(cvv) ? { key: 'cvvInvalid', values: { length: cvvLen } } : null,
    holderId: !holderId ? { key: 'idRequired' } : !israeliIdValid(holderId) ? { key: 'idInvalid' } : null,
  };
  const shown = (field: Field) => {
    const err = errors[field];
    return err && (touched[field] || submitted) ? t(`errors.${err.key}`, err.values) : null;
  };
  const describedBy = (field: Field, hint = false) =>
    shown(field) ? `${ids[field]}-error` : hint ? `${ids[field]}-hint` : undefined;
  const blur = (field: Field) => () => setTouched((s) => ({ ...s, [field]: true }));

  const fillTestCard = (cardNumber: string) => {
    setNumber(formatCardNumber(cardNumber));
    setExpiry((v) => v || futureExpiry());
    setCvv((v) => v || '123');
    setHolderId((v) => v || '000000018');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const firstInvalid = (Object.keys(errors) as Field[]).find((f) => errors[f]);
    if (firstInvalid) {
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }
    if (config.testMode && simulationForCard(number) === '3ds') {
      setChallenge(true);
      return;
    }
    onPay(cardPayRequest(number, options.includes(installments) ? installments : 1, { testMode: config.testMode }));
  };

  if (challenge) {
    return (
      <ThreeDsChallenge
        amount={amount}
        busy={busy}
        testMode={config.testMode}
        onCancel={() => setChallenge(false)}
        onVerified={() =>
          onPay(cardPayRequest(number, options.includes(installments) ? installments : 1, { testMode: true, simulation: '3ds' }))
        }
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        id={ids.number}
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
          id={ids.number}
          name="cardnumber"
          dir="ltr"
          inputMode="numeric"
          // Test mode: discourage the browser from offering a real saved card.
          autoComplete={config.testMode ? 'off' : 'cc-number'}
          placeholder="0000 0000 0000 0000"
          value={number}
          maxLength={cardMaxLength(brand) + 4}
          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
          onBlur={blur('number')}
          disabled={busy}
          aria-invalid={!!shown('number')}
          aria-describedby={describedBy('number')}
          className={cn(inputClass, 'font-mono text-left pe-28', shown('number') ? 'border-red-400' : 'border-gray-300')}
        />
      </TextField>

      <div className="grid grid-cols-2 gap-3">
        <TextField id={ids.expiry} label={t('card.expiry')} error={shown('expiry')}>
          <input
            id={ids.expiry}
            dir="ltr"
            inputMode="numeric"
            autoComplete={config.testMode ? 'off' : 'cc-exp'}
            placeholder={t('card.expiryPlaceholder')}
            value={expiry}
            maxLength={5}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            onBlur={blur('expiry')}
            disabled={busy}
            aria-invalid={!!shown('expiry')}
            aria-describedby={describedBy('expiry')}
            className={cn(inputClass, 'font-mono text-left', shown('expiry') ? 'border-red-400' : 'border-gray-300')}
          />
        </TextField>
        <TextField id={ids.cvv} label={t('card.cvv')} error={shown('cvv')} hint={t('card.cvvHint')}>
          <input
            id={ids.cvv}
            dir="ltr"
            inputMode="numeric"
            type="password"
            autoComplete={config.testMode ? 'off' : 'cc-csc'}
            placeholder={'•'.repeat(cvvLen)}
            value={cvv}
            maxLength={cvvLen}
            onChange={(e) => setCvv(digitsOnly(e.target.value).slice(0, cvvLen))}
            onBlur={blur('cvv')}
            disabled={busy}
            aria-invalid={!!shown('cvv')}
            aria-describedby={describedBy('cvv', true)}
            className={cn(inputClass, 'font-mono text-left', shown('cvv') ? 'border-red-400' : 'border-gray-300')}
          />
        </TextField>
      </div>

      <TextField id={ids.holderId} label={t('card.holderId')} error={shown('holderId')}>
        <input
          id={ids.holderId}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          value={holderId}
          maxLength={9}
          onChange={(e) => setHolderId(digitsOnly(e.target.value).slice(0, 9))}
          onBlur={blur('holderId')}
          disabled={busy}
          aria-invalid={!!shown('holderId')}
          aria-describedby={describedBy('holderId')}
          className={cn(inputClass, 'font-mono text-left', shown('holderId') ? 'border-red-400' : 'border-gray-300')}
        />
      </TextField>

      <div>
        <label htmlFor={ids.installments} className={labelClass}>
          {t('card.installments')}
        </label>
        {options.length > 1 ? (
          <select
            id={ids.installments}
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            disabled={busy}
            className={cn(inputClass, 'border-gray-300 bg-white')}
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {t('card.installmentOption', { count: n, amount: formatPrice(Math.round((total / n) * 100) / 100) })}
              </option>
            ))}
          </select>
        ) : (
          <>
            <p id={ids.installments} className="text-sm text-gray-700">
              {t('card.singlePayment')}
            </p>
            {config.installments.max > 1 && config.installments.minTotal > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {t('card.installmentsFrom', { min: formatPrice(config.installments.minTotal) })}
              </p>
            )}
          </>
        )}
      </div>

      {submitted && Object.values(errors).some(Boolean) && (
        <p className="text-xs text-red-600" role="status">
          {t('errors.fixFields')}
        </p>
      )}

      <button type="submit" disabled={busy} aria-busy={busy} className={payButtonClass}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
        {busy ? t('processing') : t('pay', { amount })}
      </button>

      {config.testMode && <TestCards onUse={fillTestCard} disabled={busy} />}
    </form>
  );
}

function TestCards({ onUse, disabled }: { onUse: (number: string) => void; disabled: boolean }) {
  const t = useTranslations('payment.testCards');
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 text-sm">
      <p className="font-medium text-amber-900 flex items-center gap-1.5 mb-2">
        <FlaskConical size={14} aria-hidden="true" /> {t('title')}
      </p>
      <ul className="space-y-1.5">
        {TEST_CARDS.map((card) => {
          const formatted = formatCardNumber(card.number);
          return (
            <li key={card.number} className="flex items-center justify-between gap-3">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs" dir="ltr">
                  {formatted}
                </span>
                <span className="text-xs text-gray-600">{t(card.simulation)}</span>
              </span>
              <button
                type="button"
                onClick={() => onUse(card.number)}
                disabled={disabled}
                aria-label={t('useCard', { number: formatted })}
                className="shrink-0 text-xs text-ocean-700 underline underline-offset-2 hover:text-ocean-800 disabled:opacity-50"
              >
                {t('use')}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{t('hint')}</p>
    </div>
  );
}

/** Fake issuer challenge for the 3-D Secure test card (code 123456). */
function ThreeDsChallenge({
  amount,
  busy,
  testMode,
  onCancel,
  onVerified,
}: {
  amount: string;
  busy: boolean;
  testMode: boolean;
  onCancel: () => void;
  onVerified: () => void;
}) {
  const t = useTranslations('payment');
  const uid = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (code !== '123456') {
      setError(true);
      return;
    }
    onVerified();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`${uid}-title`}
      className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck size={28} className="text-ocean-700 shrink-0" aria-hidden="true" />
        <div>
          <h3 id={`${uid}-title`} className="font-medium">
            {t('threeDs.title')}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{t('threeDs.body')}</p>
          <p className="text-sm font-semibold mt-2">{amount}</p>
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-code`} className={labelClass}>
          {t('threeDs.code')}
        </label>
        <input
          id={`${uid}-code`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          // The challenge replaces the card form; move focus to it.
          autoFocus
          value={code}
          maxLength={6}
          onChange={(e) => {
            setCode(digitsOnly(e.target.value).slice(0, 6));
            setError(false);
          }}
          disabled={busy}
          aria-invalid={error}
          aria-describedby={error ? `${uid}-code-error` : testMode ? `${uid}-code-hint` : undefined}
          className={cn(inputClass, 'font-mono text-center tracking-[0.4em]', error ? 'border-red-400' : 'border-gray-300')}
        />
        {error ? (
          <p id={`${uid}-code-error`} role="alert" className="mt-1 text-xs text-red-600">
            {t('errors.threeDsCode')}
          </p>
        ) : (
          testMode && (
            <p id={`${uid}-code-hint`} className="mt-1 text-xs text-amber-700">
              {t('threeDs.testHint')}
            </p>
          )
        )}
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={payButtonClass}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {busy ? t('processing') : t('threeDs.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-5 py-3 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
        >
          {t('threeDs.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Bit: request sent to the shopper's phone, approved in the app (2s in the mock). */
export function BitForm({
  amount,
  testMode,
  initialPhone,
  busy,
  onPay,
}: {
  amount: string;
  testMode: boolean;
  initialPhone: string;
  busy: boolean;
  onPay: (body: PayRequest) => void;
}) {
  const t = useTranslations('payment');
  const uid = useId();
  const [phone, setPhone] = useState(() => formatIsraeliMobile(initialPhone));
  const [touched, setTouched] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Switching tabs while "waiting for the app" abandons the request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalid = !israeliMobileValid(phone);
  const showError = touched && invalid;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || waiting) return;
    setTouched(true);
    if (invalid) {
      document.getElementById(`${uid}-phone`)?.focus();
      return;
    }
    setWaiting(true);
    // Emulates the shopper approving the request in the Bit app.
    await new Promise((r) => setTimeout(r, 2000));
    if (!mounted.current) return;
    setWaiting(false);
    onPay({ method: 'bit', ...(testMode ? { simulation: 'success' as const } : {}) });
  };

  if (waiting) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <Smartphone size={40} className="text-ocean-700 animate-pulse" aria-hidden="true" />
        <p className="font-medium">{t('bit.waiting')}</p>
        <p className="text-sm text-gray-500">{t('bit.waitingHint')}</p>
        <p className="text-sm font-mono" dir="ltr">
          {phone}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-gray-600">{t('bit.intro')}</p>
      <TextField id={`${uid}-phone`} label={t('bit.phone')} error={showError ? t('errors.phoneInvalid') : null}>
        <input
          id={`${uid}-phone`}
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="050-1234567"
          value={phone}
          onChange={(e) => setPhone(formatIsraeliMobile(e.target.value))}
          onBlur={() => setTouched(true)}
          disabled={busy}
          aria-invalid={showError}
          aria-describedby={showError ? `${uid}-phone-error` : undefined}
          className={cn(inputClass, 'font-mono text-left', showError ? 'border-red-400' : 'border-gray-300')}
        />
      </TextField>
      <button type="submit" disabled={busy} aria-busy={busy} className={payButtonClass}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Smartphone size={16} aria-hidden="true" />}
        {busy ? t('processing') : `${t('bit.submit')} · ${amount}`}
      </button>
    </form>
  );
}

/** Apple Pay: one tap, instant approval in the mock. */
export function ApplePayForm({
  testMode,
  busy,
  onPay,
}: {
  testMode: boolean;
  busy: boolean;
  onPay: (body: PayRequest) => void;
}) {
  const t = useTranslations('payment');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('applePay.intro')}</p>
      <button
        type="button"
        onClick={() => onPay({ method: 'apple_pay', ...(testMode ? { simulation: 'success' as const } : {}) })}
        disabled={busy}
        aria-busy={busy}
        className="w-full bg-black text-white py-3 text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
        {busy ? t('processing') : t('applePay.button')}
      </button>
    </div>
  );
}
