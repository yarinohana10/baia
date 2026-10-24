'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Mail } from 'lucide-react';
import { getMyMarketingConsent, setMyMarketingConsent } from '@/lib/newsletter';

/** Marketing-email opt-in/out for the signed-in user (PUT /newsletter/me). */
export function MarketingCard() {
  const t = useTranslations('account');
  const locale = useLocale();
  const id = useId();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'on' | 'off' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyMarketingConsent()
      .then((res) => !cancelled && setConsent(res.marketingConsent))
      .catch(() => !cancelled && setConsent(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    setStatus(null);
    const previous = consent;
    setConsent(next);
    try {
      const res = await setMyMarketingConsent(next, { source: 'account', locale });
      setConsent(res.marketingConsent);
      setStatus(res.marketingConsent ? 'on' : 'off');
    } catch {
      setConsent(previous);
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="bg-white border border-gray-200 rounded-none p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-[#F7F7F7] rounded-none text-black shrink-0">
          <Mail size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-base font-semibold text-black">
            {t('marketingTitle')}
          </h2>
          <p className="text-sm text-neutral-600 mt-1">{t('marketingDescription')}</p>

          <div className="mt-4 flex items-center gap-3">
            <button
              id={`${id}-switch`}
              type="button"
              role="switch"
              aria-checked={consent === true}
              aria-labelledby={`${id}-label`}
              disabled={consent === null || saving}
              onClick={() => toggle(!consent)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 ${
                consent ? 'bg-black' : 'bg-gray-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  consent ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'
                }`}
              />
            </button>
            <span id={`${id}-label`} className="text-sm text-black">
              {t('marketingToggle')}
            </span>
            {(consent === null || saving) && <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />}
          </div>

          {status === 'on' && (
            <p role="status" className="mt-3 text-sm text-black">
              {t('marketingSavedOn')}
            </p>
          )}
          {status === 'off' && (
            <p role="status" className="mt-3 text-sm text-black">
              {t('marketingSavedOff')}
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="mt-3 text-sm text-red-500">
              {t('marketingError')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
