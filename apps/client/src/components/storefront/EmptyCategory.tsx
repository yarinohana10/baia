import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { NavItem } from './Header';

export function EmptyCategory({ name, suggestions }: { name?: string; suggestions: NavItem[] }) {
  const t = useTranslations('storefront.empty');

  return (
    <section
      aria-labelledby="empty-title"
      className="mx-auto max-w-2xl rounded-none border border-gray-100 bg-[#F7F7F7] px-6 py-12 text-center sm:px-12 sm:py-16"
    >
      <svg aria-hidden="true" viewBox="0 0 120 24" className="mx-auto mb-6 h-6 w-28 text-neutral-400">
        <path
          d="M0 12c10 0 10-8 20-8s10 8 20 8 10-8 20-8 10 8 20 8 10-8 20-8 10 8 20 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M0 20c10 0 10-8 20-8s10 8 20 8 10-8 20-8 10 8 20 8 10-8 20-8 10 8 20 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity=".5"
        />
      </svg>
      <p className="mb-3 text-xs font-medium tracking-widest uppercase text-neutral-700">{t('eyebrow')}</p>
      <h2 id="empty-title" className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">
        {t('title')}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
        {name ? t('body', { name }) : t('bodyGeneric')}
      </p>

      {suggestions.length > 0 && (
        <div className="mt-8">
          <h3 className="sr-only">{t('browse')}</h3>
          <ul className="flex flex-wrap justify-center gap-2.5">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="inline-flex px-4 py-1.5 text-sm border border-gray-300 rounded-none transition-colors hover:border-neutral-600"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 border-t border-gray-200 pt-8">
        <p className="text-base font-semibold text-gray-900">{t('notify')}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{t('notifyBody')}</p>
        <Link
          href="/register"
          className="mt-5 inline-block bg-black text-white px-8 py-3 text-[13px] font-bold tracking-[0.1em] uppercase rounded-none hover:bg-neutral-800 transition-colors"
        >
          {t('notify')}
        </Link>
      </div>
    </section>
  );
}
