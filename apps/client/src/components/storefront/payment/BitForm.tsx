'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone } from 'lucide-react';
import { formatIsraeliMobile, israeliMobileValid, type PayRequest } from '@/lib/payment';
import { BusyIcon } from './BusyIcon';
import { TextField } from './TextField';
import { payButtonClass, paymentInputClasses } from './styles';

/** How long the mock waits for the shopper to approve in the Bit app. */
const BIT_APPROVAL_MS = 2000;

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
    await new Promise((r) => setTimeout(r, BIT_APPROVAL_MS));
    if (!mounted.current) return;
    setWaiting(false);
    onPay({ method: 'bit', ...(testMode ? { simulation: 'success' as const } : {}) });
  };

  if (waiting) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <Smartphone size={40} className="text-black animate-pulse" aria-hidden="true" />
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
          className={paymentInputClasses(showError, 'font-mono text-left')}
        />
      </TextField>
      <button type="submit" disabled={busy} aria-busy={busy} className={payButtonClass}>
        <BusyIcon busy={busy} icon={<Smartphone size={16} aria-hidden="true" />} />
        {busy ? t('processing') : `${t('bit.submit')} · ${amount}`}
      </button>
    </form>
  );
}
