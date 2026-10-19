import { getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { businessInfo, fillTemplate, LEGAL_UPDATED_AT, type BusinessInfo } from '@/lib/site';
import type { SiteConfig } from '@/lib/catalog/types';

const LEGAL_DATE_FORMAT = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }),
  en: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }),
};

/** One legal section as stored in messages/<locale>/legal.json (raw, with `{placeholders}`). */
export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** Paragraphs shown after the bullet list. */
  after?: string[];
};

/** Fills `{placeholders}` (business details, delivery costs...) in every string of the sections. */
export function fillSections(sections: LegalSection[], vars: Record<string, string | number>): LegalSection[] {
  const fill = (s: string) => fillTemplate(s, vars);
  return sections.map((s) => ({
    id: s.id,
    title: fill(s.title),
    paragraphs: s.paragraphs?.map(fill),
    items: s.items?.map(fill),
    after: s.after?.map(fill),
  }));
}

/** Placeholder values for legal copy, from the admin site settings. */
export async function legalVars(config: SiteConfig | null): Promise<{ info: BusinessInfo; vars: Record<string, string | number> }> {
  const info = businessInfo(config);
  const tFooter = await getTranslations('footer');
  return {
    info,
    vars: {
      businessName: info.businessName,
      companyIdText: info.companyId ? tFooter('companyId', { id: info.companyId }) : tFooter('companyIdSoon'),
      address: info.businessAddress,
      phone: info.businessPhone,
      email: info.contactEmail,
      courierCost: info.courierCost,
      pickupCost: info.pickupCost,
      threshold: info.freeShippingThreshold,
      courierEta: info.courierEtaDays,
      pickupEta: info.pickupEtaDays,
      cancelHours: info.selfCancelWindowHours,
    },
  };
}

/**
 * Long-form legal page (terms, privacy, accessibility): header, table of
 * contents (sticky on desktop, collapsible on mobile), numbered sections and an
 * optional aside. Shows a "needs lawyer review" note outside production.
 */
export async function LegalPage({
  locale,
  eyebrow,
  title,
  intro,
  sections,
  aside,
  children,
}: {
  locale: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [t, tLegal] = await Promise.all([getTranslations('storefront'), getTranslations('legal')]);
  const updated = LEGAL_DATE_FORMAT[locale === 'he' ? 'he' : 'en'].format(new Date(`${LEGAL_UPDATED_AT}T12:00:00Z`));

  const toc = (
    <ol className="space-y-1 text-sm">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block rounded-md px-3 py-1.5 text-gray-600 transition-colors hover:bg-ocean-50 hover:text-ocean-700"
          >
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <article>
      <header className="border-b border-gray-200 bg-warm-50">
        <div className="container-page pb-12 pt-8 sm:pb-16">
          <Breadcrumbs items={[{ label: t('home'), href: '/' }, { label: title }]} label={t('breadcrumb')} locale={locale} />
          <p className="mt-8 text-xs font-medium uppercase tracking-widest text-ocean-700">{eyebrow}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-normal text-gray-900">{title}</h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-gray-500">{intro}</p>
          <p className="mt-4 text-sm text-gray-400">{tLegal('updated', { date: updated })}</p>
        </div>
      </header>

      <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Table of contents */}
        <nav aria-label={tLegal('tocTitle')} className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <details className="group rounded-xl border border-gray-200 bg-white p-2 lg:hidden">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-gray-900 marker:hidden">
              {tLegal('tocTitle')}
            </summary>
            <div className="mt-1">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500">{tLegal('tocTitle')}</p>
            {toc}
          </div>
        </nav>

        <div className="prose-baia min-w-0 max-w-3xl">
          {process.env.NODE_ENV !== 'production' && (
            <p role="note" className="mb-8 border-s-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm !text-gray-900">
              {tLegal('lawyerNotice')}
            </p>
          )}
          {children}
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-28 border-b border-gray-100 pb-8 last:border-0">
              <h2 id={`${s.id}-title`}>{s.title}</h2>
              <div className="space-y-3">
                {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
                {s.items && s.items.length > 0 && (
                  <ul>
                    {s.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p, i) => <p key={`a${i}`}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-6 lg:col-start-2 xl:col-start-auto xl:sticky xl:top-28 xl:self-start">
          {aside}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <MessageCircle size={22} strokeWidth={1.4} aria-hidden="true" className="text-ocean-700" />
            <h2 className="mt-3 text-base font-semibold text-gray-900">{tLegal('questionsTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">{tLegal('questionsBody')}</p>
            <Link
              href="/contact"
              className="mt-4 inline-flex rounded-lg bg-ocean-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
            >
              {tLegal('contactCta')}
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
