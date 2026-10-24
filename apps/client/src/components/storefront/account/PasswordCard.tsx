'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { authErrorKey, changePassword, listAccounts } from '@/lib/auth-client';
import {
  accountInputClass,
  accountSectionLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textButtonClass,
} from './styles';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Change password with the current one. Other devices are signed out
 * (revokeOtherSessions); this browser gets a fresh session from better-auth.
 * Accounts created with Google have no password, so the form is not offered.
 */
export function PasswordCard() {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    listAccounts()
      .then(({ data }) => setHasPassword(data ? data.some((a) => a.providerId === 'credential') : true))
      // If we can't tell, offer the form; the server is the one that decides.
      .catch(() => setHasPassword(true));
  }, []);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setShow(false);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) return setError(tAuth('passwordTooShort'));
    if (next !== confirm) return setError(tAuth('passwordsDoNotMatch'));
    if (next === current) return setError(t('samePassword'));

    setSaving(true);
    try {
      const { error: apiError } = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (apiError) {
        setError(tAuth(authErrorKey(apiError)));
      } else {
        reset();
        setOpen(false);
        setDone(true);
      }
    } catch {
      setError(tAuth('genericError'));
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <section aria-labelledby="password-title" className="bg-white border border-gray-200 rounded-none p-6 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="password-title" className="text-base font-semibold text-black">
            {t('passwordTitle')}
          </h2>
          {hasPassword !== false && (
            <p className="text-sm text-neutral-600">{t('passwordDescription')}</p>
          )}
        </div>
        {hasPassword && !open && (
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
            className={`${textButtonClass} shrink-0`}
          >
            {t('changePassword')}
          </button>
        )}
      </div>

      {hasPassword === false && <p className="text-sm text-neutral-600">{t('socialOnlyPassword')}</p>}

      {done && (
        <p role="status" className="text-sm text-black">
          {t('passwordChanged')}
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="current-password" className={accountSectionLabelClass}>
              {t('currentPassword')}
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={type}
                autoComplete="current-password"
                required
                autoFocus
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={`${accountInputClass} pe-10`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? tAuth('hidePassword') : tAuth('showPassword')}
                aria-pressed={show}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black transition-colors"
              >
                {show ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-password" className={accountSectionLabelClass}>
                {t('newPassword')}
              </label>
              <input
                id="new-password"
                type={type}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={accountInputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className={accountSectionLabelClass}>
                {t('confirmNewPassword')}
              </label>
              <input
                id="confirm-new-password"
                type={type}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={accountInputClass}
              />
            </div>
          </div>
          <p className="text-xs text-neutral-600">{t('passwordSignOutNote')}</p>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} aria-busy={saving} className={primaryButtonClass}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('saving') : t('changePassword')}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={saving}
              className={secondaryButtonClass}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
