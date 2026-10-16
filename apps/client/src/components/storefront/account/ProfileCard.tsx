'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { updateUser } from '@/lib/auth-client';
import {
  accountInputClass,
  accountSectionLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textButtonClass,
} from './styles';

type Props = { name: string | null | undefined; email: string };

/** Name (editable) and email. The email is the login identity, so it is read-only here. */
export function ProfileCard({ name, email }: Props) {
  const t = useTranslations('account');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);

  const startEditing = () => {
    setValue(name ?? '');
    setStatus(null);
    setEditing(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = value.trim();
    if (!next || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const { error } = await updateUser({ name: next });
      if (error) {
        setStatus('error');
      } else {
        setStatus('saved');
        setEditing(false);
      }
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-title" className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="profile-title" className="font-body text-base font-semibold text-[#1a1c1c]">
          {t('profileTitle')}
        </h2>
        {!editing && (
          <button type="button" onClick={startEditing} className={textButtonClass}>
            {t('edit')}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="profile-name" className={accountSectionLabelClass}>
              {t('nameLabel')}
            </label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={accountInputClass}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving || !value.trim()} aria-busy={saving} className={primaryButtonClass}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('saving') : t('save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={secondaryButtonClass}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className={accountSectionLabelClass}>{t('nameLabel')}</p>
          <p className="font-body text-base text-[#1a1c1c]">{name || '—'}</p>
        </div>
      )}

      <div>
        <p className={accountSectionLabelClass}>{t('emailLabel')}</p>
        <p className="font-body text-base text-[#1a1c1c]">
          <bdi dir="ltr">{email}</bdi>
        </p>
      </div>

      {status === 'saved' && (
        <p role="status" className="font-body text-sm text-ocean-700">
          {t('profileSaved')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="font-body text-sm text-red-500">
          {t('profileSaveError')}
        </p>
      )}
    </section>
  );
}
