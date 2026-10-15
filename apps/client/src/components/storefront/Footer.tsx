import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { Wordmark } from './Wordmark';
import type { NavItem } from './Header';

function FooterLinks({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <h2 className="eyebrow mb-4 text-white/60">{title}</h2>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[15px] text-white/85 underline-offset-4 hover:text-white hover:underline">
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

  const help: NavItem[] = [
    { label: t('shippingPolicy'), href: '/shipping' },
    { label: t('returnsExchanges'), href: '/returns' },
    { label: t('contactUs'), href: '/contact' },
    { label: t('aboutUs'), href: '/about' },
  ];
  const shop: NavItem[] = [...categories, { label: tNav('newArrivals'), href: '/new-arrivals' }];
  const account: NavItem[] = [
    { label: tCommon('login'), href: '/login' },
    { label: tCommon('register'), href: '/register' },
  ];

  return (
    <footer className="bg-ink text-white">
      <div className="border-b border-white/10">
        <ul className="container-page grid gap-6 py-8 text-[14px] sm:grid-cols-3">
          {[
            { icon: Truck, label: t('freeShipping') },
            { icon: RotateCcw, label: t('easyReturns') },
            { icon: ShieldCheck, label: t('securePayment') },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 sm:justify-center">
              <Icon size={20} strokeWidth={1.4} aria-hidden="true" className="text-sun" />
              <span className="text-white/85">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Link href="/" aria-label="BAIA Swimwear" className="inline-block">
            <Wordmark tone="light" />
          </Link>
          <p className="mt-5 text-[15px] leading-relaxed text-white/70">{t('brandDescription')}</p>
          <div className="mt-6">
            <p className="font-display text-lg">{t('newsletterTitle')}</p>
            <p className="mt-1 text-sm text-white/70">{t('newsletterBody')}</p>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center rounded-[2px] border border-white/40 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white hover:text-ink"
            >
              {tCommon('register')}
            </Link>
          </div>
        </div>
        <FooterLinks title={t('shopTitle')} links={shop} />
        <FooterLinks title={t('helpTitle')} links={help} />
        <FooterLinks title={t('accountTitle')} links={account} />
      </div>

      <div className="border-t border-white/10 py-6">
        <p className="container-page text-center text-[13px] text-white/60">
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
