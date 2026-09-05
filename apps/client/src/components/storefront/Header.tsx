'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Globe,
  LogOut,
  Shield,
} from 'lucide-react';
import { useCartStore } from '@/store/cart';

function Tooltip({ label, children, align = 'center' }: { label: string; children: React.ReactNode; align?: 'center' | 'start' | 'end' }) {
  const posClass =
    align === 'start' ? 'start-0' :
      align === 'end' ? 'end-0' :
        'start-1/2 -translate-x-1/2';

  return (
    <div className="relative group/tip flex items-center">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full ${posClass} mt-2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white hidden group-hover/tip:block shadow-lg z-50`}
      >
        {label}
      </span>
    </div>
  );
}

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

function LocaleSwitcher({
  label,
  onAfterSwitch,
  className,
  children,
}: {
  label: string;
  onAfterSwitch?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const router = useRouter();

  const switchLocale = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    const pathname = window.location.pathname.replace(/^\/(en|he)(?=\/|$)/, '') || '/';
    router.replace(pathname, { locale: newLocale });
    onAfterSwitch?.();
  };

  return (
    <button
      type="button"
      onClick={switchLocale}
      className={className}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartCount = useCartStore((s) => s.itemCount());
  const openDrawer = useCartStore((s) => s.openDrawer);

  const categories = useMemo(
    () => [
      { label: tNav('men'), href: '/category/men' },
      { label: tNav('women'), href: '/category/women' },
      { label: tNav('children'), href: '/category/children' },
      { label: tNav('newArrivals'), href: '/new-arrivals' },
    ],
    [tNav],
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="container-page">
        <div className="flex items-center justify-between h-16">

          {/* ── Left: Brand + Navigation ── */}
          <div className="flex items-center gap-6 lg:gap-10 min-w-0">
            {/* Mobile hamburger */}
            <Tooltip label="Menu">
              <button
                className="lg:hidden p-1.5 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
              </button>
            </Tooltip>

            {/* Brand — always LTR so "BAIA SWIMWEAR" reads correctly in both directions */}
            <Link href="/" dir="ltr" className="flex items-baseline gap-2 flex-shrink-0 group">
              <span className="text-[22px] font-black tracking-[0.04em] text-black group-hover:text-ocean-700 transition-colors leading-none">
                BAIA
              </span>
              <span className="text-[22px] font-black tracking-[0.04em] text-black uppercase leading-none hidden sm:inline group-hover:text-ocean-700 transition-colors">
                SWIMWEAR
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="text-[15px] font-semibold text-neutral-700 hover:text-black transition-colors whitespace-nowrap relative after:absolute after:bottom-[-2px] after:start-0 after:h-[1.5px] after:w-0 after:bg-ocean-600 after:transition-all after:duration-300 hover:after:w-full"
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Right: Action icons ── */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Language switch */}
            <Tooltip label={t('switchLang')} align="end">
              <LocaleSwitcher
                label={t('switchLang')}
                className="p-2 text-black hover:text-ocean-700 hover:bg-ocean-50 rounded-full transition-all duration-200"
              >
                <Globe size={21} strokeWidth={2} />
              </LocaleSwitcher>
            </Tooltip>

            {/* Account */}
            {session?.user ? (
              <div className="flex items-center">
                <Tooltip label={t('myAccount')} align="end">
                  <Link
                    href="/account"
                    className="p-2 text-black hover:text-ocean-700 hover:bg-ocean-50 rounded-full transition-all duration-200"
                  >
                    <User size={21} strokeWidth={2} />
                  </Link>
                </Tooltip>
                <Tooltip label={t('signOut')} align="end">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 text-gray-500 hover:text-ocean-700 hover:bg-ocean-50 rounded-full transition-all duration-200"
                    aria-label={t('signOut')}
                  >
                    <LogOut size={16} strokeWidth={1.8} />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip label={t('userTooltip')} align="end">
                <Link
                  href="/login"
                  className="p-2 text-black hover:text-ocean-700 hover:bg-ocean-50 rounded-full transition-all duration-200"
                >
                  <User size={21} strokeWidth={2} />
                </Link>
              </Tooltip>
            )}


            {/* Admin Panel (only for admins) */}
            {session?.user && (session.user as any).role === 'ADMIN' && (
              <Tooltip label={t('adminPanel')} align="end">
                <Link
                  href="/admin"
                  className="p-2 text-ocean-700 hover:text-ocean-900 hover:bg-ocean-50 rounded-full transition-all duration-200"
                  aria-label={t('adminPanel')}
                >
                  <Shield size={21} strokeWidth={2} />
                </Link>
              </Tooltip>
            )}
            {/* Cart */}
            <Tooltip label={t('cartTooltip')} align="end">
              <button
                onClick={openDrawer}
                className="p-2 text-black hover:text-ocean-700 hover:bg-ocean-50 rounded-full transition-all duration-200 relative"
                aria-label={t('cartTooltip')}
              >
                <ShoppingCart size={21} strokeWidth={2} />
                {cartCount > 0 && (
                  <span className="absolute bottom-0 end-0 bg-ocean-600 text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5 ring-2 ring-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white shadow-lg">
          <nav className="container-page py-4 space-y-0.5">
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="block text-[15px] text-gray-700 hover:text-ocean-700 hover:bg-ocean-50 py-3 px-3 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {cat.label}
              </Link>
            ))}
            {session?.user && (session.user as any).role === 'ADMIN' && (
              <div className="border-t border-gray-100 mt-2 pt-2">
                <Link
                  href="/admin"
                  className="flex items-center gap-3 text-[15px] text-ocean-700 font-semibold hover:text-ocean-900 hover:bg-ocean-50 py-3 px-3 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield size={18} strokeWidth={1.6} />
                  {t('adminPanel')}
                </Link>
              </div>
            )}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <LocaleSwitcher
                label={locale === 'he' ? 'English' : 'עברית'}
                onAfterSwitch={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 text-[15px] text-gray-700 hover:text-ocean-700 hover:bg-ocean-50 py-3 px-3 rounded-lg w-full transition-colors"
              >
                <Globe size={18} strokeWidth={1.6} />
                {locale === 'he' ? 'English' : 'עברית'}
              </LocaleSwitcher>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
