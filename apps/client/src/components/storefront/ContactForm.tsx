'use client';

import { useTranslations } from 'next-intl';

/**
 * No backend send yet: on submit we compose a mailto: link so the customer's own
 * email app sends the message. Swap for an API call when a contact endpoint exists.
 */
export function ContactForm({ to }: { to: string }) {
  const t = useTranslations('pages.contact');

  const field = 'mt-1.5 block w-full rounded-[2px] border border-sand-300 bg-white px-3.5 py-3 text-[15px] text-ink placeholder:text-stone/70';
  const label = 'block text-sm font-semibold text-ink';

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const name = String(data.get('name') || '');
        const email = String(data.get('email') || '');
        const order = String(data.get('order') || '');
        const message = String(data.get('message') || '');
        const subject = order ? `${t('formTitle')} — #${order}` : t('formTitle');
        const body = `${message}\n\n— ${name}${email ? ` <${email}>` : ''}${order ? `\n#${order}` : ''}`;
        window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={label}>
          {t('name')}
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className={label}>
          {t('email')}
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={field} />
        </label>
      </div>
      <label className={label}>
        {t('orderNumber')}
        <input name="order" inputMode="numeric" dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t('message')}
        <textarea name="message" required rows={6} className={field} />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="inline-flex justify-center rounded-[2px] bg-ink px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-coral"
        >
          {t('submit')}
        </button>
        <p className="text-sm text-stone">{t('formNote')}</p>
      </div>
    </form>
  );
}
