import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Truck, ShieldCheck, RotateCcw, Mail, Clock } from 'lucide-react';
import { CONTACT_EMAIL } from '@/lib/site';
import type { NavItem } from './Header';
import { Wordmark } from './Wordmark';

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

export function Footer({ categories }: { categories: NavItem[] }) {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tContact = useTranslations('pages.contact');

  const perks = [
    { icon: Truck, title: t('freeShipping'), body: t('freeShippingSub') },
    { icon: RotateCcw, title: t('easyReturns'), body: t('easyReturnsSub') },
    { icon: ShieldCheck, title: t('securePayment'), body: t('securePaymentSub') },
  ];

  const shop: NavItem[] = [...categories, { label: tNav('newArrivals'), href: '/new-arrivals' }];
  const care: NavItem[] = [
    { label: t('shippingPolicy'), href: '/shipping' },
    { label: t('returnsExchanges'), href: '/returns' },
    { label: t('contactUs'), href: '/contact' },
    { label: t('aboutUs'), href: '/about' },
  ];
  const account: NavItem[] = [
    { label: tCommon('login'), href: '/login' },
    { label: tCommon('register'), href: '/register' },
    { label: t('myOrders'), href: '/account/orders' },
    { label: tCommon('wishlist'), href: '/wishlist' },
  ];

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

      {/* Main */}
      <div className="container-page py-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand + contact */}
          <div className="col-span-2 lg:col-span-1 max-w-sm">
            <Link href="/" aria-label="BAIA Swimwear" className="inline-block">
              <Wordmark tone="light" />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-white/65">{t('brandDescription')}</p>

            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Mail size={16} strokeWidth={1.6} aria-hidden="true" className="text-ocean-200 shrink-0" />
                <span className="sr-only">{tContact('emailLabel')}: </span>
                <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="text-white/80 hover:text-white transition-colors">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock size={16} strokeWidth={1.6} aria-hidden="true" className="text-ocean-200 shrink-0" />
                <span className="sr-only">{tContact('hoursLabel')}: </span>
                <span className="text-white/80">{tContact('hours')}</span>
              </li>
            </ul>

            <div className="mt-8 rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-sm font-semibold">{t('newsletterTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{t('newsletterBody')}</p>
              <Link
                href="/register"
                className="mt-4 inline-block bg-white text-ocean-800 px-5 py-2.5 text-[12px] font-bold tracking-[0.1em] uppercase rounded-lg hover:bg-ocean-100 transition-colors"
              >
                {t('clubCta')}
              </Link>
            </div>
          </div>

          <FooterColumn title={t('shopTitle')} links={shop} />
          <FooterColumn title={t('careTitle')} links={care} />
          <FooterColumn title={t('accountTitle')} links={account} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row">
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={14} strokeWidth={1.6} aria-hidden="true" />
            {t('secureCheckoutNote')}
          </p>
        </div>
      </div>
    </footer>
  );
}
