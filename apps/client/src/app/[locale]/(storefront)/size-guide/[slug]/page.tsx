import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight, Check, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/storefront/Breadcrumbs';
import { JsonLd } from '@/components/storefront/JsonLd';
import { HowToMeasure } from '@/components/storefront/size-guide/HowToMeasure';
import { SizeGuideTables } from '@/components/storefront/size-guide/SizeGuideTables';
import { getSiteConfig, getSizeGuides } from '@/lib/catalog/server';
import { localized, shopCategoryFor } from '@/lib/catalog/size-guides';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { businessInfo, whatsappHref } from '@/lib/site';
import { cn } from '@/lib/utils';

// Rendered per request like product pages; the guide data itself is cached
// (tag "size-guides", purged when an admin saves).
type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = (await getSizeGuides()).find((g) => g.slug === slug);
  if (!guide) return {};
  const t = await getTranslations({ locale, namespace: 'sizeGuide' });
  const name = localized(locale, guide.nameHe, guide.nameEn);
  return pageMetadata({
    locale,
    path: `/size-guide/${slug}`,
    title: t('metaTitle', { name }),
    description: t('metaDescription', { name }),
    images: guide.imageUrl ? [{ url: guide.imageUrl, alt: localized(locale, guide.imageAltHe, guide.imageAltEn) }] : undefined,
  });
}

export default async function SizeGuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [guides, config, t, tStore] = await Promise.all([
    getSizeGuides(),
    getSiteConfig(),
    getTranslations('sizeGuide'),
    getTranslations('storefront'),
  ]);
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();

  const name = localized(locale, guide.nameHe, guide.nameEn);
  const intro = localized(locale, guide.introHe, guide.introEn);
  const shop = shopCategoryFor(guide);
  const whatsapp = whatsappHref(businessInfo(config).whatsappNumber, t('whatsappPrefill', { name }));
  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;

  return (
    <article>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tStore('home'), url: absoluteUrl(locale, '/') },
          { name: t('title'), url: absoluteUrl(locale, `/size-guide/${slug}`) },
        ])}
      />

      <header className="border-b border-ocean-100 bg-[#F3F8FB]">
        <div className="container-page pb-10 pt-8 text-center sm:pb-14">
          <div className="text-start">
            <Breadcrumbs items={[{ label: tStore('home'), href: '/' }, { label: t('title') }]} label={tStore('breadcrumb')} locale={locale} />
          </div>
          <p className="mt-8 text-[12px] font-semibold uppercase text-logo-blue ltr:tracking-[0.24em]">{t('eyebrow')}</p>
          <h1 className="mt-3 text-[24px] font-semibold uppercase text-ink ltr:tracking-[0.08em] sm:text-[30px]">{t('title')}</h1>
          {intro && <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-black/60 sm:text-[16px]">{intro}</p>}

          {guides.length > 1 && (
            <nav aria-label={t('tabsLabel')} className="mt-8 flex justify-center">
              <ul className="inline-flex max-w-full gap-1 overflow-x-auto border border-ocean-100 bg-white p-1">
                {guides.map((g) => {
                  const active = g.slug === guide.slug;
                  return (
                    <li key={g.id} className="shrink-0">
                      <Link
                        href={`/size-guide/${g.slug}`}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 min-w-24 items-center justify-center px-5 text-[13px] font-semibold uppercase ltr:tracking-[0.12em] transition-colors',
                          active ? 'bg-ocean-700 text-white' : 'text-ocean-700 hover:bg-ocean-50',
                        )}
                      >
                        {localized(locale, g.nameHe, g.nameEn)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </header>

      <div className="container-page space-y-16 py-12 sm:space-y-20 sm:py-16">
        {guide.tables.length > 0 && (
          <section aria-label={t('chartsLabel', { name })} className="mx-auto max-w-4xl">
            <SizeGuideTables tables={guide.tables} locale={locale} sizeLabel={t('size')} />
            <p className="mt-3 text-center text-[12px] text-black/45 sm:hidden">{t('scrollHint')}</p>
          </section>
        )}

        <div className="mx-auto max-w-5xl">
          <HowToMeasure guide={guide} locale={locale} title={t('howToMeasure')} />
        </div>

        {guide.tips.length > 0 && (
          <section aria-labelledby="size-tips" className="mx-auto max-w-5xl">
            <h2 id="size-tips" className="sr-only">
              {t('tipsTitle')}
            </h2>
            <ul className="grid gap-px border border-ocean-100 bg-ocean-100 sm:grid-cols-3">
              {guide.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 bg-white px-5 py-5 text-[14px] leading-relaxed text-black/70 sm:flex-col sm:items-center sm:text-center">
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EAF3F9] text-ocean-700">
                    <Check size={16} strokeWidth={2} />
                  </span>
                  {localized(locale, tip.he, tip.en)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="size-help" className="mx-auto flex max-w-5xl flex-col items-center gap-5 bg-[#F3F8FB] px-6 py-10 text-center sm:py-12">
          <h2 id="size-help" className="text-[17px] font-semibold uppercase text-ink ltr:tracking-[0.06em] sm:text-[19px]">
            {t('helpTitle')}
          </h2>
          <p className="max-w-md text-[14px] leading-relaxed text-black/60">{t('helpBody')}</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 bg-ocean-700 px-6 text-[13px] font-semibold uppercase text-white ltr:tracking-[0.1em] transition-colors hover:bg-ocean-800"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {t('whatsapp')}
              </a>
            ) : (
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center bg-ocean-700 px-6 text-[13px] font-semibold uppercase text-white ltr:tracking-[0.1em] hover:bg-ocean-800"
              >
                {t('contact')}
              </Link>
            )}
            {shop && (
              <Link
                href={`/category/${shop.slug}`}
                className="group inline-flex min-h-11 items-center gap-2 border border-ocean-700 px-6 text-[13px] font-semibold uppercase text-ocean-700 ltr:tracking-[0.1em] transition-colors hover:bg-white"
              >
                {t('shop', { name: localized(locale, shop.nameHe, shop.nameEn) })}
                <Arrow size={15} aria-hidden="true" className="transition-transform group-hover:ltr:translate-x-0.5 group-hover:rtl:-translate-x-0.5" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
