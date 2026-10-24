import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight, MessageSquare, XCircle } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { StaticPage, type StaticSection } from '@/components/storefront/StaticPage';
import { WhatsAppGlyph } from '@/components/storefront/WhatsAppGlyph';
import { getSiteConfig } from '@/lib/catalog/server';
import { businessInfo, fillTemplate, whatsappHref } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.returns' });
  return pageMetadata({ locale, path: '/returns', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tWhatsapp, config] = await Promise.all([
    getTranslations('pages.returns'),
    getTranslations('legal.whatsapp'),
    getSiteConfig(),
  ]);
  const info = businessInfo(config);
  const whatsapp = whatsappHref(info.whatsappNumber, tWhatsapp('prefill'));
  const vars = {};
  const sections = (t.raw('sections') as StaticSection[]).map((s) => ({
    title: fillTemplate(s.title, vars),
    body: fillTemplate(s.body, vars),
  }));
  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      aside={
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-gray-500">{t('ctaTitle')}</h2>

          <Link
            href="/cancel-order"
            className="group flex gap-4 rounded-none border border-neutral-300 bg-[#F7F7F7]/60 p-5 transition-colors hover:border-neutral-500"
          >
            <XCircle size={24} strokeWidth={1.4} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold text-gray-900">
                {t('ctaCancel')}
                <Arrow size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </span>
              <span className="mt-1 block text-sm text-gray-600">{t('ctaCancelBody')}</span>
            </span>
          </Link>

          <div className="rounded-none border border-gray-200 bg-white p-5">
            <div className="flex gap-4">
              <MessageSquare size={24} strokeWidth={1.4} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{t('ctaExchange')}</p>
                <p className="mt-1 text-sm text-gray-600">{t('ctaExchangeBody')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/contact"
                    className="inline-flex rounded-none bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                  >
                    {t('ctaContact')}
                  </Link>
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-none border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <WhatsAppGlyph size={16} className="text-[#25D366]" />
                      {t('ctaWhatsapp')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link href="/terms#cancellation" className="inline-block text-sm font-semibold text-black underline-offset-4 hover:underline">
            {t('termsLink')}
          </Link>
        </div>
      }
    />
  );
}
