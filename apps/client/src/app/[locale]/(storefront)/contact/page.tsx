import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mail, Clock } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { StaticPage } from '@/components/storefront/StaticPage';
import { ContactForm } from '@/components/storefront/ContactForm';
import { CONTACT_EMAIL } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.contact' });
  return pageMetadata({ locale, path: '/contact', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.contact');

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      aside={
        <dl className="space-y-6 border border-gray-200 bg-white p-6">
          <div className="flex gap-3">
            <Mail size={20} strokeWidth={1.4} aria-hidden="true" className="mt-0.5 text-ocean-700" />
            <div>
              <dt className="text-xs font-medium tracking-widest uppercase text-gray-500">{t('emailLabel')}</dt>
              <dd className="mt-1">
                <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-semibold text-gray-900 underline underline-offset-4">
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock size={20} strokeWidth={1.4} aria-hidden="true" className="mt-0.5 text-ocean-700" />
            <div>
              <dt className="text-xs font-medium tracking-widest uppercase text-gray-500">{t('hoursLabel')}</dt>
              <dd className="mt-1 text-gray-900">{t('hours')}</dd>
            </div>
          </div>
        </dl>
      }
    >
      <h2 className="!mt-0">{t('formTitle')}</h2>
      <ContactForm to={CONTACT_EMAIL} />
    </StaticPage>
  );
}
