import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mail, Clock, Phone, MapPin } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { StaticPage } from '@/components/storefront/StaticPage';
import { ContactForm } from '@/components/storefront/ContactForm';
import { WhatsAppGlyph } from '@/components/storefront/WhatsAppGlyph';
import { getSiteConfig } from '@/lib/catalog/server';
import { businessInfo, telHref, whatsappHref } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.contact' });
  return pageMetadata({ locale, path: '/contact', title: t('metaTitle'), description: t('metaDescription') });
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-black">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-widest text-gray-500">{label}</dt>
        <dd className="mt-1">{children}</dd>
      </div>
    </div>
  );
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tWhatsapp, config] = await Promise.all([
    getTranslations('pages.contact'),
    getTranslations('legal.whatsapp'),
    getSiteConfig(),
  ]);
  const info = businessInfo(config);
  const whatsapp = whatsappHref(info.whatsappNumber, tWhatsapp('prefill'));
  const link = 'font-semibold text-gray-900 underline underline-offset-4 hover:text-black';

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      aside={
        <dl className="space-y-6 rounded-none border border-gray-200 bg-white p-6">
          {whatsapp && (
            <Row icon={<WhatsAppGlyph size={20} />} label={t('whatsappLabel')}>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={link}>
                {t('whatsappCta')}
              </a>
            </Row>
          )}
          <Row icon={<Phone size={20} strokeWidth={1.4} aria-hidden="true" />} label={t('phoneLabel')}>
            <a href={telHref(info.businessPhone)} dir="ltr" className={link}>
              {info.businessPhone}
            </a>
          </Row>
          <Row icon={<Mail size={20} strokeWidth={1.4} aria-hidden="true" />} label={t('emailLabel')}>
            <a href={`mailto:${info.contactEmail}`} dir="ltr" className={`${link} break-all`}>
              {info.contactEmail}
            </a>
          </Row>
          <Row icon={<Clock size={20} strokeWidth={1.4} aria-hidden="true" />} label={t('hoursLabel')}>
            <span className="text-gray-900">{t('hours')}</span>
          </Row>
          <Row icon={<MapPin size={20} strokeWidth={1.4} aria-hidden="true" />} label={t('addressLabel')}>
            <span className="block text-gray-900">{info.businessAddress}</span>
            <span className="block text-sm text-gray-500">{t('addressNote')}</span>
          </Row>
        </dl>
      }
    >
      <h2 className="!mt-0">{t('formTitle')}</h2>
      <ContactForm fallbackEmail={info.contactEmail} />
    </StaticPage>
  );
}
