'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Globe,
} from 'lucide-react';

export function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const categories = [
    { label: tNav('women'), href: '/category/women' },
    { label: tNav('men'), href: '/category/men' },
    { label: tNav('children'), href: '/category/children' },
    { label: tNav('sale'), href: '/sale' },
    { label: tNav('newArrivals'), href: '/new-arrivals' },
  ];

  const switchLocale = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      {/* Top bar */}
      <div className="bg-ocean-700 text-white text-center text-xs py-1.5 tracking-wider">
        {t('home') === 'דף הבית' ? 'משלוח חינם בקנייה מעל ₪249' : 'Free shipping on orders over ₪249'}
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 -ms-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link href="/" className="text-2xl font-light tracking-[0.3em] text-ocean-700">
            BAIA
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="text-sm tracking-wider text-charcoal hover:text-ocean-600 transition-colors uppercase"
              >
                {cat.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 hover:text-ocean-600 transition-colors"
              aria-label={t('search')}
            >
              <Search size={20} />
            </button>

            <button
              onClick={switchLocale}
              className="p-2 hover:text-ocean-600 transition-colors hidden sm:block"
              aria-label="Switch language"
            >
              <Globe size={20} />
            </button>

            <Link
              href="/wishlist"
              className="p-2 hover:text-ocean-600 transition-colors hidden sm:block"
              aria-label={t('wishlist')}
            >
              <Heart size={20} />
            </Link>

            <Link
              href="/cart"
              className="p-2 hover:text-ocean-600 transition-colors relative"
              aria-label={t('cart')}
            >
              <ShoppingBag size={20} />
            </Link>

            {session?.user ? (
              <Link
                href="/account"
                className="p-2 hover:text-ocean-600 transition-colors hidden sm:block"
                aria-label={t('account')}
              >
                <User size={20} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="p-2 hover:text-ocean-600 transition-colors hidden sm:block text-sm tracking-wider"
              >
                {t('login')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('search')}
                className="w-full ps-10 pe-4 py-2.5 border border-gray-300 focus:border-ocean-500 focus:outline-none text-sm"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-4 space-y-3">
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="block text-sm tracking-wider text-charcoal hover:text-ocean-600 py-2 uppercase"
                onClick={() => setMobileMenuOpen(false)}
              >
                {cat.label}
              </Link>
            ))}
            <hr className="border-gray-100" />
            <button
              onClick={() => { switchLocale(); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 text-sm text-charcoal py-2"
            >
              <Globe size={16} />
              {locale === 'he' ? 'English' : 'עברית'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
