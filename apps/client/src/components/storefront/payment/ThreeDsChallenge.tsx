'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ShieldCheck } from 'lucide-react';
import { digitsOnly } from '@/lib/payment';
import { payButtonClass, paymentInputClasses, paymentLabelClass } from './styles';

/** The code the mock issuer accepts. */
const TEST_CODE = '123456';

/** Fake issuer challenge for the 3-D Secure test card (code 123456). */
export function ThreeDsChallenge({
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
  const codeInput = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  // The challenge replaces the card form: move focus to its code field.
  useEffect(() => {
    codeInput.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (code !== TEST_CODE) {
      setError(true);
      return;
    }
    onVerified();
  };

  let describedBy: string | undefined;
  if (error) describedBy = `${uid}-code-error`;
  else if (testMode) describedBy = `${uid}-code-hint`;

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
        <label htmlFor={`${uid}-code`} className={paymentLabelClass}>
          {t('threeDs.code')}
        </label>
        <input
          ref={codeInput}
          id={`${uid}-code`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          maxLength={6}
          onChange={(e) => {
            setCode(digitsOnly(e.target.value).slice(0, 6));
            setError(false);
          }}
          disabled={busy}
          aria-invalid={error}
          aria-describedby={describedBy}
          className={paymentInputClasses(error, 'font-mono text-center tracking-[0.4em]')}
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
