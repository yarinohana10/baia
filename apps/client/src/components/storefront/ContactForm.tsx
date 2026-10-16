'use client';

import { useTranslations } from 'next-intl';

/**
 * No backend send yet: on submit we compose a mailto: link so the customer's own
 * email app sends the message. Swap for an API call when a contact endpoint exists.
 */
export function ContactForm({ to }: { to: string }) {
  const t = useTranslations('pages.contact');

  const field = 'mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-[15px] text-gray-900 placeholder:text-gray-400';
  const label = 'block text-sm font-semibold text-gray-900';

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
          className="inline-flex justify-center rounded-lg bg-ocean-700 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-ocean-600"
        >
          {t('submit')}
        </button>
        <p className="text-sm text-gray-500">{t('formNote')}</p>
      </div>
    </form>
  );
}
