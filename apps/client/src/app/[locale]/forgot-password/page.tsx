'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { requestPasswordReset } from '@/lib/auth-client';
import {
  AuthAlert,
  AuthCardLayout,
  authButtonClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
} from '@/components/storefront/AuthCardLayout';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: err } = await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/${locale}/reset-password`,
      });
      // The server answers the same way whether or not the email exists; only
      // rate limiting / outages surface as errors.
      if (err && err.status === 429) setError(t('tooManyRequests'));
      else if (err && (err.status ?? 500) >= 500) setError(t('genericError'));
      else setSent(true);
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCardLayout title={t('resetLinkSentTitle')} subtitle={t('resetLinkSent', { email })}>
        <Link href="/login" className={authLinkClass}>
          {t('backToSignIn')}
        </Link>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout title={t('forgotPasswordTitle')} subtitle={t('forgotPasswordSubtitle')}>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <form onSubmit={handleSubmit} className="flex flex-col space-y-8">
        <div className="flex flex-col space-y-2">
          <label htmlFor="email" className={authLabelClass}>
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className={`${authInputClass} text-start`}
          />
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : t('sendResetLink')}
        </button>
      </form>
      <Link href="/login" className={authLinkClass}>
        {t('backToSignIn')}
      </Link>
    </AuthCardLayout>
  );
}
