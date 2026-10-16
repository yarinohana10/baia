'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { ShoppingBag, User, Menu, X, LogOut, Shield } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { Wordmark } from './Wordmark';

export type NavItem = { label: string; href: string };

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

function LocaleSwitcher({ className, onAfterSwitch }: { className?: string; onAfterSwitch?: () => void }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');
  const target = locale === 'he' ? 'en' : 'he';

  return (
    <button
      type="button"
      onClick={() => {
        router.replace(pathname, { locale: target });
        onAfterSwitch?.();
      }}
      className={className}
      aria-label={t('switchLang')}
      lang={target}
    >
      {target === 'en' ? 'EN' : 'עב'}
    </button>
  );
}

const iconButton =
  'relative inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5';

export function Header({ nav }: { nav: NavItem[] }) {
  const t = useTranslations('common');
  const ts = useTranslations('storefront');
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const cartCount = useCartStore((s) => s.itemCount());
  const openDrawer = useCartStore((s) => s.openDrawer);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 font-brand">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        {ts('skipToContent')}
      </a>

      <p className="bg-ink px-4 py-2 text-center text-[12px] font-semibold tracking-wide text-white/90">
        {ts('announcement')}
      </p>

      <div className="border-b border-header-line bg-shell/95 backdrop-blur supports-[backdrop-filter]:bg-shell/85">
        <div className="container-header grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-20">
          {/* Start: menu (mobile) / nav (desktop) */}
          <div className="flex items-center">
            <button
              type="button"
              className={`${iconButton} -ms-2 lg:hidden`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? ts('closeMenu') : ts('menu')}
            >
              {menuOpen ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
            </button>

            <nav aria-label={ts('primaryNav')} className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="relative py-2 text-[15px] font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Center: wordmark */}
          <Link href="/" aria-label="BAIA Swimwear" className="justify-self-center">
            <Wordmark />
          </Link>

          {/* End: actions */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <LocaleSwitcher className={`${iconButton} hidden text-[13px] font-bold sm:inline-flex`} />

            {session?.user ? (
              <>
                <Link href="/account" className={iconButton} aria-label={t('myAccount')}>
                  <User size={20} strokeWidth={1.6} />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`${iconButton} hidden sm:inline-flex`}
                  aria-label={t('signOut')}
                >
                  <LogOut size={18} strokeWidth={1.6} />
                </button>
              </>
            ) : (
              <Link href="/login" className={iconButton} aria-label={t('userTooltip')}>
                <User size={20} strokeWidth={1.6} />
              </Link>
            )}

            {isAdmin && (
              <Link href="/admin" className={`${iconButton} hidden sm:inline-flex`} aria-label={t('adminPanel')}>
                <Shield size={19} strokeWidth={1.6} />
              </Link>
            )}

            <button type="button" onClick={openDrawer} className={`${iconButton} -me-2`} aria-label={t('cartTooltip')}>
              <ShoppingBag size={20} strokeWidth={1.6} />
              {cartCount > 0 && (
                <span className="absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="absolute inset-x-0 top-full border-b border-header-line bg-shell shadow-[0_24px_48px_-24px_rgba(15,42,54,0.25)] lg:hidden"
      >
        <nav aria-label={ts('primaryNav')} className="container-header py-4">
          <ul>
            {nav.map((item) => (
              <li key={item.href} className="border-b border-header-line last:border-0">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="block py-4 font-display text-2xl text-ink aria-[current=page]:text-header-active"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-header-line pt-4 text-sm font-semibold">
            <LocaleSwitcher
              onAfterSwitch={() => setMenuOpen(false)}
              className="rounded-full border border-ink/20 px-4 py-2 text-ink"
            />
            {isAdmin && (
              <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-ink">
                <Shield size={16} strokeWidth={1.6} />
                {t('adminPanel')}
              </Link>
            )}
            {session?.user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-ink"
              >
                <LogOut size={16} strokeWidth={1.6} />
                {t('signOut')}
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
