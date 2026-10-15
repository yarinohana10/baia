'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { authErrorKey, resetPassword } from '@/lib/auth-client';
import {
  AuthAlert,
  AuthCardLayout,
  authButtonClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
} from '@/components/storefront/AuthCardLayout';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  // better-auth redirects here with ?error=INVALID_TOKEN when its own link was used with a bad token.
  const token = searchParams.get('token');
  const linkError = searchParams.get('error');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalidLink, setInvalidLink] = useState(!token || !!linkError);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('passwordTooShort'));
    if (password !== confirmPassword) return setError(t('passwordsDoNotMatch'));

    setLoading(true);
    try {
      const { error: err } = await resetPassword({ newPassword: password, token: token! });
      if (!err) setDone(true);
      else if (authErrorKey(err) === 'invalidResetLink') setInvalidLink(true);
      else setError(t(authErrorKey(err)));
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthCardLayout title={t('passwordResetSuccessTitle')} subtitle={t('passwordResetSuccess')}>
        <Link href="/login" className={authButtonClass}>
          {t('signIn')}
        </Link>
      </AuthCardLayout>
    );
  }

  if (invalidLink) {
    return (
      <AuthCardLayout title={t('resetPasswordTitle')}>
        <AuthAlert tone="error">{t('invalidResetLink')}</AuthAlert>
        <Link href="/forgot-password" className={authButtonClass}>
          {t('requestNewLink')}
        </Link>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout title={t('resetPasswordTitle')} subtitle={t('resetPasswordSubtitle')}>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <form onSubmit={handleSubmit} className="flex flex-col space-y-8">
        <div className="flex flex-col space-y-2">
          <label htmlFor="password" className={authLabelClass}>
            {t('newPasswordLabel')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`${authInputClass} pe-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <label htmlFor="confirmPassword" className={authLabelClass}>
            {t('confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={authInputClass}
          />
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : t('resetPasswordButton')}
        </button>
      </form>
    </AuthCardLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
