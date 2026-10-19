'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { CONTACT_PHONE_PATTERN, contactErrorKind, sendContactMessage, type ContactError } from '@/lib/contact';

const SUBJECTS = ['general', 'sizing', 'order', 'exchange', 'cancel', 'other'] as const;
type SubjectKey = (typeof SUBJECTS)[number];

const ERROR_KEY: Record<ContactError, 'errorFailed' | 'errorRateLimited' | 'errorInvalid'> = {
  failed: 'errorFailed',
  rateLimited: 'errorRateLimited',
  invalid: 'errorInvalid',
};

/** Contact form: posts to POST /contact, which stores the message, emails the store and auto-replies. */
export function ContactForm({ fallbackEmail }: { fallbackEmail: string }) {
  const t = useTranslations('pages.contact');
  const locale = useLocale();
  const id = useId();
  const [sending, setSending] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);
  const [error, setError] = useState<ContactError | null>(null);

  const field =
    'mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-100';
  const label = 'block text-sm font-semibold text-gray-900';
  const req = (
    <span aria-hidden="true" className="text-red-500">
      {' '}*
    </span>
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = (k: string) => String(data.get(k) ?? '').trim();
    const subjectKey = value('subject') as SubjectKey;

    setSending(true);
    setError(null);
    try {
      await sendContactMessage({
        name: value('name'),
        email: value('email'),
        phone: value('phone'),
        orderNumber: value('orderNumber'),
        subject: SUBJECTS.includes(subjectKey) ? t(`subjectOptions.${subjectKey}`) : undefined,
        message: value('message'),
        locale,
        website: value('website'),
      });
      setSentName(value('name'));
      form.reset();
    } catch (err) {
      setError(contactErrorKind(err));
    } finally {
      setSending(false);
    }
  };

  if (sentName !== null) {
    return (
      <div role="status" className="rounded-xl border border-ocean-100 bg-ocean-50/60 p-6 sm:p-8">
        <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden="true" className="text-ocean-700" />
        <h3 className="mt-3 text-lg font-semibold text-gray-900">{t('successTitle')}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{t('successBody', { name: sentName })}</p>
        <button
          type="button"
          onClick={() => setSentName(null)}
          className="mt-5 text-sm font-semibold text-ocean-700 underline-offset-4 hover:underline"
        >
          {t('sendAnother')}
        </button>
      </div>
    );
  }

  return (
    <form className="relative space-y-5" onSubmit={onSubmit} aria-busy={sending}>
      <p className="text-sm text-gray-500">{t('requiredNote')}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={label}>
            {t('name')}
            {req}
          </label>
          <input id={`${id}-name`} name="name" required maxLength={100} autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={label}>
            {t('email')}
            {req}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            dir="ltr"
            className={`${field} rtl:text-right`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={label}>
            {t('phone')}
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            pattern={CONTACT_PHONE_PATTERN}
            dir="ltr"
            className={`${field} rtl:text-right`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-order`} className={label}>
            {t('orderNumber')}
          </label>
          <input id={`${id}-order`} name="orderNumber" maxLength={40} dir="ltr" className={`${field} rtl:text-right`} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-subject`} className={label}>
          {t('subject')}
        </label>
        <select id={`${id}-subject`} name="subject" defaultValue="general" className={field}>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {t(`subjectOptions.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-message`} className={label}>
          {t('message')}
          {req}
        </label>
        <textarea id={`${id}-message`} name="message" required maxLength={5000} rows={6} className={field} />
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden="true" className="pointer-events-none absolute -start-[10000px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>{t('honeypot')}</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t(ERROR_KEY[error])}
          {error === 'failed' && (
            <>
              {' '}
              <a href={`mailto:${fallbackEmail}`} dir="ltr" className="font-semibold underline underline-offset-4">
                {fallbackEmail}
              </a>
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-700 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-70"
        >
          {sending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {sending ? t('sending') : t('submit')}
        </button>
        <p className="text-sm text-gray-500">{t('formNote')}</p>
      </div>
    </form>
  );
}
