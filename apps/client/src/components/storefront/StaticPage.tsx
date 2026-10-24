import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from './Breadcrumbs';

export type StaticSection = { title: string; body: string };

/**
 * Shared layout for content pages (shipping, returns, contact, about).
 * Copy lives in messages/{he,en}.json under `pages.*` and is PLACEHOLDER text for the owner to edit;
 * a notice is shown outside production so it isn't forgotten.
 */
export async function StaticPage({
  locale,
  eyebrow,
  title,
  intro,
  sections = [],
  children,
  aside,
  placeholderNotice = true,
}: {
  locale: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections?: StaticSection[];
  children?: React.ReactNode;
  aside?: React.ReactNode;
  /** Show the "placeholder copy" reminder outside production (off for functional pages). */
  placeholderNotice?: boolean;
}) {
  const [t, tPages] = await Promise.all([getTranslations('storefront'), getTranslations('pages')]);

  return (
    <article>
      <header className="border-b border-gray-200 bg-[#F7F7F7]">
        <div className="container-page pb-12 pt-8 sm:pb-16">
          <Breadcrumbs items={[{ label: t('home'), href: '/' }, { label: title }]} label={t('breadcrumb')} locale={locale} />
          <p className="text-xs font-medium tracking-widest uppercase mt-8 text-black">{eyebrow}</p>
          <h1 className="mt-3 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{title}</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-gray-500">{intro}</p>
        </div>
      </header>

      <div className="container-page grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
        <div className="prose-baia max-w-2xl">
          {placeholderNotice && process.env.NODE_ENV !== 'production' && (
            <p role="note" className="mb-8 border-s-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-gray-900">
              {tPages('placeholderNotice')}
            </p>
          )}
          {children}
          {sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        {aside && <aside className="lg:pt-2">{aside}</aside>}
      </div>
    </article>
  );
}
