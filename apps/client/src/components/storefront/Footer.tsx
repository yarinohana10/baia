import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Truck, ShieldCheck, RotateCcw, Mail, Clock, Phone, MapPin, PackageSearch, XCircle } from 'lucide-react';
import type { SiteConfig } from '@/lib/catalog/types';
import { businessInfo, telHref, whatsappHref } from '@/lib/site';
import type { NavItem } from './Header';
import { Wordmark } from './Wordmark';
import { NewsletterForm } from './NewsletterForm';
import { WhatsAppGlyph } from './WhatsAppGlyph';

function FooterColumn({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold tracking-widest uppercase text-white mb-5">{title}</h2>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-white/65 hover:text-white transition-colors">
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

  const quickLink =
    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const quickLinkGhost = `${quickLink} text-white ring-1 ring-white/25 hover:bg-white/10`;

  return (
    <footer className="bg-ocean-800 text-white">
      {/* Perks */}
      <div className="bg-ocean-700">
        <ul className="container-page grid grid-cols-1 sm:grid-cols-3">
          {perks.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-center gap-4 py-6 border-white/10 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-s sm:justify-center sm:px-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-white/60 mt-0.5">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick service links - order cancellation must be easy to find (חוק הגנת הצרכן). */}
      <nav aria-label={t('careTitle')} className="border-b border-white/10">
        <div className="container-page flex flex-wrap items-center gap-3 py-5">
          <Link href="/cancel-order" className={`${quickLink} bg-white text-ocean-800 hover:bg-ocean-100`}>
            <XCircle size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('cancelOrder')}
          </Link>
          <Link href="/order-status" className={quickLinkGhost}>
            <PackageSearch size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('trackOrder')}
          </Link>
          <Link href="/returns" className={quickLinkGhost}>
            <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('returnsExchanges')}
          </Link>
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={quickLinkGhost}>
              <WhatsAppGlyph size={16} />
              {t('whatsappLabel')}
            </a>
          )}
          <p className="w-full text-xs text-white/55 sm:ms-auto sm:w-auto">{t('cancelOrderSub')}</p>
        </div>
      </nav>

      {/* Main */}
      <div className="container-page py-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          {/* Brand + newsletter */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 max-w-sm">
            <Link href="/" aria-label="BAIA Swimwear" className="inline-block">
              <Wordmark tone="light" />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-white/65">{t('brandDescription')}</p>

            <div className="mt-8 rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-sm font-semibold">{t('newsletterTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{t('newsletterBody')}</p>
              <NewsletterForm />
            </div>
          </div>

          <FooterColumn title={t('shopTitle')} links={shop} />
          <FooterColumn title={t('careTitle')} links={care} />
          <FooterColumn title={t('legalTitle')} links={legal} />
          <FooterColumn title={t('accountTitle')} links={account} />
        </div>
      </div>

      {/* Business details */}
      <div className="border-t border-white/10">
        <div className="container-page py-8">
          <h2 className="sr-only">{t('businessTitle')}</h2>
          <address className="not-italic grid gap-x-8 gap-y-3 text-sm text-white/75 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            <p className="font-semibold text-white">
              {info.businessName}
              <span className="mx-2 text-white/30" aria-hidden="true">·</span>
              <span className="font-normal text-white/75">
                {info.companyId ? t('companyId', { id: info.companyId }) : t('companyIdSoon')}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-200" />
              <span className="sr-only">{t('addressLabel')}: </span>
              {info.businessAddress}
            </p>
            <p className="flex items-center gap-2">
              <Phone size={15} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-200" />
              <span className="sr-only">{t('phoneLabel')}: </span>
              <a href={telHref(info.businessPhone)} dir="ltr" className="transition-colors hover:text-white">
                {info.businessPhone}
              </a>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Mail size={15} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-200" />
              <span className="sr-only">{t('emailLabel')}: </span>
              <a href={`mailto:${info.contactEmail}`} dir="ltr" className="break-all transition-colors hover:text-white">
                {info.contactEmail}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Clock size={15} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-200" />
              <span className="sr-only">{tContact('hoursLabel')}: </span>
              {tContact('hours')}
            </p>
          </address>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-center text-xs text-white/50 sm:flex-row sm:text-start">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <p>{t('vatNote')}</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={14} strokeWidth={1.6} aria-hidden="true" />
            {t('secureCheckoutNote')}
          </p>
        </div>
      </div>
    </footer>
  );
}
