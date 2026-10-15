import { Breadcrumbs, type Crumb } from './Breadcrumbs';

export function ListingHeader({
  title,
  countLabel,
  crumbs,
  breadcrumbLabel,
  locale,
}: {
  title: string;
  countLabel: string;
  crumbs: Crumb[];
  breadcrumbLabel: string;
  locale: string;
}) {
  return (
    <header className="border-b border-sand-200 bg-sand-50">
      <div className="container-page pb-10 pt-8 sm:pb-14">
        <Breadcrumbs items={crumbs} label={breadcrumbLabel} locale={locale} />
        <h1 className="mt-6 font-display text-[40px] leading-none text-ink sm:text-6xl">{title}</h1>
        <p className="mt-3 text-[15px] text-stone">{countLabel}</p>
      </div>
    </header>
  );
}
