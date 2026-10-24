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
    <div className="flex items-start gap-3 bg-[#F7F7F7]/60 border border-neutral-300 rounded-none p-4 mb-6">
      <MailCheck size={20} strokeWidth={1.8} className="text-black shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-semibold text-black">{t('verifyBannerTitle')}</p>
        <p className="text-sm text-neutral-600">
          {t.rich('verifyBannerText', {
            email: () => (
              <bdi dir="ltr" className="font-medium">
                {email}
              </bdi>
            ),
          })}
        </p>
        {state === 'sent' ? (
          <p role="status" className="text-sm text-black">
            {t('verificationSent')}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resend}
              disabled={state === 'sending'}
              className="inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-4 hover:text-black disabled:opacity-60"
            >
              {state === 'sending' && <Loader2 size={14} className="animate-spin" />}
              {t('resendVerification')}
            </button>
            {state === 'error' && (
              <span role="alert" className="text-sm text-[#93000a]">
                {t('verificationSendError')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
