'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Loader2 } from 'lucide-react';
import { authErrorKey, signIn } from '@/lib/auth-client';
import { Link } from '@/i18n/navigation';
import { AuthErrorBanner } from './AuthErrorBanner';
import { GoogleSignInButton } from './GoogleSignInButton';
import { OrDivider } from './OrDivider';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

const labelClass = 'font-body text-xs font-bold uppercase tracking-[0.1em] text-[#1a1c1c]';
const underlineClass =
  'absolute bottom-0 start-0 h-px bg-[#005d72] w-0 group-focus-within:w-full transition-all duration-500 ease-out';

/** `?redirect=` target: same-origin paths only, never `//host` or absolute URLs (open redirect). */
function redirectTarget(locale: string): string {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  const safe = redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\');
  return safe ? redirect : `/${locale}`;
}

/** Email + password sign-in, then Google; errors show above the form. */
export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const onGoogleError = useCallback(() => setError(t('genericError')), [t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(t(authErrorKey(result.error)));
      } else {
        window.location.href = redirectTarget(locale);
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthErrorBanner message={error} />

      <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
        {/* Email */}
        <div className="flex flex-col space-y-2 relative group">
          <label htmlFor="email" className={labelClass}>
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full bg-transparent border-b border-[#bec8cd] py-3 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 placeholder:text-[#3f484c]/50"
          />
          <div className={underlineClass} />
        </div>

        {/* Password */}
        <div className="flex flex-col space-y-2 relative group">
          <div className="flex justify-between items-center">
            <label htmlFor="password" className={labelClass}>
              {t('passwordLabel')}
            </label>
            <Link
              href="/forgot-password"
              className="font-body text-xs font-medium tracking-[0.05em] text-[#005d72] hover:text-[#007791] transition-colors"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-transparent border-b border-[#bec8cd] py-3 pe-10 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 placeholder:text-[#3f484c]/50"
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
            />
          </div>
          <div className={underlineClass} />
        </div>

        {/* Actions */}
        <div className="pt-8 flex flex-col space-y-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#565555] text-white font-body text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-sm hover:bg-[#1a1c1c] transition-colors duration-300 shadow-sm hover:shadow-md disabled:opacity-70 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{t('signIn')}</span>
                  <ArrowRight size={16} className="rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>

          <OrDivider />

          <GoogleSignInButton onError={onGoogleError} className="rounded-sm" />

          <div className="text-center pt-6">
            <p className="font-body text-base text-[#3f484c]">
              {t('newToBaia')}{' '}
              <Link
                href="/register"
                className="font-body text-sm font-bold uppercase tracking-[0.1em] text-[#1a1c1c] underline underline-offset-4 decoration-[#bec8cd] hover:decoration-[#005d72] transition-colors ms-1"
              >
                {t('createAnAccount')}
              </Link>
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
