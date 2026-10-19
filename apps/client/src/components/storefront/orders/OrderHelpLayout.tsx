import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '../Breadcrumbs';

/** Header band + two-column body for the order-status and cancel-order pages. */
export async function OrderHelpLayout({
  locale,
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  locale: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const t = await getTranslations('storefront');
  return (
    <article>
      <header className="border-b border-gray-200 bg-warm-50">
        <div className="container-page pb-12 pt-8 sm:pb-14">
          <Breadcrumbs items={[{ label: t('home'), href: '/' }, { label: title }]} label={t('breadcrumb')} locale={locale} />
          <p className="text-xs font-medium tracking-widest uppercase mt-8 text-ocean-700">{eyebrow}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-normal text-gray-900">{title}</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-gray-500">{intro}</p>
        </div>
      </header>
      <div className="container-page grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="max-w-xl">{children}</div>
        {aside && <aside className="lg:pt-1">{aside}</aside>}
      </div>
    </article>
  );
}
