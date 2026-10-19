'use client';

import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Loader2 } from 'lucide-react';
import { registerFormSchema } from '@baia/shared';
import { authErrorKey, signUp } from '@/lib/auth-client';
import { setMyMarketingConsent } from '@/lib/newsletter';
import { firstInvalidField, validateForm } from '@/lib/form-errors';
import { Link } from '@/i18n/navigation';
import { AuthErrorBanner } from './AuthErrorBanner';
import { FloatingLabelField } from './FloatingLabelField';
import { GoogleSignInButton } from './GoogleSignInButton';
import { OrDivider } from './OrDivider';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

const FIELD_ORDER = ['name', 'email', 'password', 'confirmPassword'] as const;
type Field = (typeof FIELD_ORDER)[number];
const FIELD_INPUT_ID: Record<Field, string> = {
  name: 'fullName',
  email: 'email',
  password: 'password',
  confirmPassword: 'confirmPassword',
};

const termsLinkClass = 'font-semibold text-[#005d72] underline underline-offset-2 hover:text-[#007791]';

/** Name, email, password (twice), newsletter opt-in, then Google; errors show above the form. */
export function RegisterForm() {
  const t = useTranslations('auth');
  const tRoot = useTranslations();
  const locale = useLocale();
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const onGoogleError = useCallback(() => setError(t('genericError')), [t]);
  const field = (name: Field) => ({
    id: FIELD_INPUT_ID[name],
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: e.target.value })),
    required: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const check = validateForm(registerFormSchema, { ...values, marketingConsent: newsletter });
    if (!check.success) {
      const first = firstInvalidField(check.errors, FIELD_ORDER) as Field | undefined;
      const issue = first ? check.errors[first] : undefined;
      if (first && issue) {
        setError(first === 'confirmPassword' ? t('passwordsDoNotMatch') : tRoot(issue.key, issue.values));
        document.getElementById(FIELD_INPUT_ID[first])?.focus();
      }
      return;
    }

    setLoading(true);
    try {
      const { name, email, password } = check.data;
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(t(authErrorKey(result.error)));
      } else {
        if (newsletter) {
          // Explicit opt-in only (box is never pre-ticked). Best effort: a failure
          // here must not block the new account - it can be changed in the account page.
          await setMyMarketingConsent(true, { source: 'register', locale }).catch(() => undefined);
        }
        window.location.href = `/${locale}`;
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

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <FloatingLabelField type="text" label={t('fullNameLabel')} {...field('name')} />
          <FloatingLabelField type="email" label={t('emailLabel')} {...field('email')} />
          <FloatingLabelField
            type={showPassword ? 'text' : 'password'}
            label={t('passwordLabel')}
            minLength={8}
            inputClassName="pe-10"
            {...field('password')}
          >
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              className="absolute end-1 top-3 text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
            />
          </FloatingLabelField>
          <FloatingLabelField type="password" label={t('confirmPasswordLabel')} minLength={8} {...field('confirmPassword')} />
        </div>

        {/* Newsletter checkbox */}
        <div className="flex items-start gap-3">
          <div className="flex items-center h-5 mt-1">
            <input
              id="newsletter"
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="w-4 h-4 rounded border-[#bec8cd] text-[#005d72] focus:ring-[#005d72] focus:ring-2 cursor-pointer accent-[#005d72]"
            />
          </div>
          <label htmlFor="newsletter" className="font-body text-sm text-[#3f484c] cursor-pointer">
            {t('newsletterSignup')}
          </label>
        </div>

        <p className="font-body text-xs leading-relaxed text-[#3f484c]">
          {t.rich('termsNotice', {
            terms: (chunks) => (
              <Link href="/terms" target="_blank" className={termsLinkClass}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" target="_blank" className={termsLinkClass}>
                {chunks}
              </Link>
            ),
          })}
        </p>

        {/* Actions */}
        <div className="pt-4 space-y-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#565555] text-white font-body text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-full hover:bg-[#1a1c1c] transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>{t('createAccount')}</span>
                <ArrowRight size={16} className="rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform duration-300" />
              </>
            )}
          </button>

          <OrDivider />

          <GoogleSignInButton onError={onGoogleError} className="rounded-full" />

          <div className="text-center">
            <p className="font-body text-base text-[#3f484c]">
              {t('alreadyHaveAccount')}{' '}
              <Link
                href="/login"
                className="font-body text-sm font-bold uppercase tracking-[0.1em] text-[#005d72] hover:text-[#007791] transition-colors relative after:absolute after:bottom-0 after:start-0 after:w-full after:h-px after:bg-current after:scale-x-[0.95] hover:after:scale-x-100 after:origin-end hover:after:origin-start after:transition-transform after:duration-300"
              >
                {t('signInLink')}
              </Link>
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
