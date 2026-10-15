import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { NavItem } from './Header';

export function EmptyCategory({ name, suggestions }: { name?: string; suggestions: NavItem[] }) {
  const t = useTranslations('storefront.empty');

  return (
    <section
      aria-labelledby="empty-title"
      className="mx-auto max-w-2xl border border-sand-200 bg-sand-50 px-6 py-14 text-center sm:px-12 sm:py-20"
    >
      <svg aria-hidden="true" viewBox="0 0 120 24" className="mx-auto mb-6 h-6 w-28 text-ocean-300">
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
      <p className="eyebrow mb-3 text-ocean-700">{t('eyebrow')}</p>
      <h2 id="empty-title" className="font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-stone">
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
                  className="inline-flex rounded-full border border-ink/25 px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 border-t border-sand-200 pt-8">
        <p className="font-display text-xl text-ink">{t('notify')}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-stone">{t('notifyBody')}</p>
        <Link
          href="/register"
          className="mt-5 inline-flex rounded-[2px] bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-coral"
        >
          {t('notify')}
        </Link>
      </div>
    </section>
  );
}
