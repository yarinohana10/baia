import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import type { SiteConfig } from '@/lib/catalog/types';
import { SOCIAL_LINKS, businessInfo, telHref, whatsappHref } from '@/lib/site';
import type { NavItem } from './Header';
import { NewsletterForm } from './NewsletterForm';
import { WhatsAppGlyph } from './WhatsAppGlyph';
import { InstagramGlyph, TikTokGlyph } from './SocialGlyphs';

const SOCIAL_GLYPHS = { instagram: InstagramGlyph, tiktok: TikTokGlyph };

function FooterColumn({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <h2 className="mb-4 text-[12px] font-semibold uppercase ltr:tracking-[0.08em] text-black">{title}</h2>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[13px] text-black/70 transition-colors hover:text-black">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ categories, config }: { categories: NavItem[]; config: SiteConfig | null }) {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tContact = useTranslations('pages.contact');
  const tWhatsapp = useTranslations('legal.whatsapp');

  const info = businessInfo(config);
  const whatsapp = whatsappHref(info.whatsappNumber, tWhatsapp('prefill'));

  const perks = [
    { icon: Truck, title: t('freeShipping', { threshold: info.freeShippingThreshold }), body: t('freeShippingSub') },
    { icon: RotateCcw, title: t('easyReturns'), body: t('easyReturnsSub') },
    { icon: ShieldCheck, title: t('securePayment'), body: t('securePaymentSub') },
  ];

  const shop: NavItem[] = [...categories, { label: tNav('newArrivals'), href: '/new-arrivals' }];
  const care: NavItem[] = [
    { label: t('shippingPolicy'), href: '/shipping' },
    { label: t('returnsExchanges'), href: '/returns' },
    { label: t('trackOrder'), href: '/order-status' },
    { label: t('cancelOrder'), href: '/cancel-order' },
    { label: t('contactUs'), href: '/contact' },
    { label: t('aboutUs'), href: '/about' },
  ];
  const legal: NavItem[] = [
    { label: t('terms'), href: '/terms' },
    { label: t('privacy'), href: '/privacy' },
    { label: t('accessibility'), href: '/accessibility' },
  ];
  const account: NavItem[] = [
    { label: tCommon('login'), href: '/login' },
    { label: tCommon('register'), href: '/register' },
    { label: t('myOrders'), href: '/account/orders' },
    { label: tCommon('wishlist'), href: '/wishlist' },
  ];

  return (
    <footer className="border-t border-neutral-200 bg-white text-black">
      {/* Perks */}
      <ul className="container-page flex flex-col items-center gap-4 border-b border-neutral-200 py-8 sm:flex-row sm:justify-center sm:gap-16">
        {perks.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-2.5 text-[12px] font-medium uppercase ltr:tracking-[0.12em]">
            <Icon size={18} strokeWidth={1.3} aria-hidden="true" />
            {title}
          </li>
        ))}
      </ul>

      {/* Newsletter */}
      <div className="container-page py-14 sm:py-16">
        <div className="max-w-none">
          <h2 className="text-[17px] sm:text-[18px] font-semibold uppercase ltr:tracking-[0.04em]">{t('newsletterTitle')}</h2>
          <p className="mt-2 text-[13px] text-black/70">{t('newsletterBody')}</p>
          <NewsletterForm />
          <div className="mt-8">
            <h2 className="text-[12px] font-semibold uppercase ltr:tracking-[0.08em]">{t('followTitle')}</h2>
            <ul className="mt-2 -ms-2.5 flex items-center gap-1">
              {SOCIAL_LINKS.map(({ id, name, href }) => {
                const Glyph = SOCIAL_GLYPHS[id];
                return (
                  <li key={id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener"
                      aria-label={t('followOn', { network: name })}
                      title={name}
                      className="flex size-11 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-sand-100/60 hover:text-ocean-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-700"
                    >
                      <Glyph size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="container-page pb-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          <FooterColumn title={t('shopTitle')} links={shop} />
          <FooterColumn title={t('careTitle')} links={care} />
          <FooterColumn title={t('legalTitle')} links={legal} />
          <div>
            <FooterColumn title={t('accountTitle')} links={account} />
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-[13px] text-black/70 transition-colors hover:text-black"
              >
                <WhatsAppGlyph size={15} />
                {t('whatsappLabel')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Business details (required on an Israeli online store) */}
      <div className="border-t border-neutral-200">
        <div className="container-page py-6">
          <h2 className="sr-only">{t('businessTitle')}</h2>
          <address className="not-italic flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-black/60">
            <span className="font-medium text-black">
              {info.businessName}
              <span className="mx-2 text-black/30" aria-hidden="true">·</span>
              <span className="font-normal text-black/60">
                {info.companyId ? t('companyId', { id: info.companyId }) : t('companyIdSoon')}
              </span>
            </span>
            <span>
              <span className="sr-only">{t('addressLabel')}: </span>
              {info.businessAddress}
            </span>
            <a href={telHref(info.businessPhone)} dir="ltr" className="hover:text-black">
              <span className="sr-only">{t('phoneLabel')}: </span>
              {info.businessPhone}
            </a>
            <a href={`mailto:${info.contactEmail}`} dir="ltr" className="break-all hover:text-black">
              <span className="sr-only">{t('emailLabel')}: </span>
              {info.contactEmail}
            </a>
            <span>
              <span className="sr-only">{tContact('hoursLabel')}: </span>
              {tContact('hours')}
            </span>
          </address>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-200">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-[11px] uppercase ltr:tracking-[0.12em] text-black/55 sm:flex-row">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <nav aria-label={t('legalTitle')} className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/cancel-order" className="font-semibold text-black hover:opacity-60">
              {t('cancelOrder')}
            </Link>
            <Link href="/terms" className="hover:text-black">
              {t('terms')}
            </Link>
            <Link href="/privacy" className="hover:text-black">
              {t('privacy')}
            </Link>
          </nav>
          <p>{t('vatNote')}</p>
        </div>
      </div>
    </footer>
  );
}
