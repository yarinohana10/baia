'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, MailCheck } from 'lucide-react';
import { getFreshSession, sendVerificationEmail } from '@/lib/auth-client';

/** Gentle, non-blocking reminder for registered users who haven't confirmed their email yet. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [verified, setVerified] = useState(false);

  // The session cookie cache can be a few minutes stale (e.g. verified on another device).
  useEffect(() => {
    getFreshSession()
      .then(({ data }) => setVerified(!!data?.user.emailVerified))
      .catch(() => undefined);
  }, []);

  const resend = async () => {
    setState('sending');
    try {
      const { error } = await sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/${locale}/account`,
      });
      setState(error ? 'error' : 'sent');
    } catch {
      setState('error');
    }
  };

  if (verified) return null;

  return (
    <div className="flex items-start gap-3 bg-ocean-50/60 border border-ocean-200 rounded-xl p-4 mb-6">
      <MailCheck size={20} strokeWidth={1.8} className="text-ocean-700 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <p className="font-body text-sm font-semibold text-[#1a1c1c]">{t('verifyBannerTitle')}</p>
        <p className="font-body text-sm text-[#3f484c]">
          {t.rich('verifyBannerText', {
            email: () => (
              <bdi dir="ltr" className="font-medium">
                {email}
              </bdi>
            ),
          })}
        </p>
        {state === 'sent' ? (
          <p role="status" className="font-body text-sm text-ocean-700">
            {t('verificationSent')}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resend}
              disabled={state === 'sending'}
              className="inline-flex items-center gap-2 font-body text-sm font-semibold text-ocean-700 underline underline-offset-4 hover:text-ocean-900 disabled:opacity-60"
            >
              {state === 'sending' && <Loader2 size={14} className="animate-spin" />}
              {t('resendVerification')}
            </button>
            {state === 'error' && (
              <span role="alert" className="font-body text-sm text-[#93000a]">
                {t('verificationSendError')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
