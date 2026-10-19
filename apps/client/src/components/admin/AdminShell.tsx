'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  Tags,
  Settings,
  Waves,
  Bell,
  Search,
  Shield,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type AdminUser = {
  name?: string | null;
  email: string;
  role?: string;
  image?: string | null;
};

const navItems = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/categories', labelKey: 'categories', icon: FolderTree },
  { href: '/admin/products', labelKey: 'products', icon: Package },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/admin/customers', labelKey: 'customers', icon: Users },
  { href: '/admin/coupons', labelKey: 'coupons', icon: Tags },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
];

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations('admin');
  const displayName = user.name || user.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  // Below lg the sidebar is an overlay drawer.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile drawer backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/30 lg:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-e border-border bg-card transition-[translate,visibility] duration-200',
          !menuOpen && 'max-lg:invisible max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-700 text-white">
            <Waves size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="font-serif text-xl leading-none tracking-[-0.02em] text-foreground">
              BAIA
            </p>
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('panelTitle')}
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="ms-auto text-muted-foreground lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label={t('nav.closeMenu')}
          >
            <X size={20} />
          </Button>
        </div>

        <div className="px-4 mb-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <ArrowLeft size={14} className="rtl:rotate-180" />
            {t('backToStore')}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 font-body text-sm transition-all',
                  isActive
                    ? 'bg-ocean-700 text-white shadow-md shadow-ocean-700/25'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <item.icon size={18} />
                {t(`nav.${item.labelKey}`)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-700 text-white">
              <Shield size={14} />
            </div>
            <div>
              <p className="font-body text-xs font-semibold text-foreground">{t('adminStatus')}</p>
              <p className="font-body text-[11px] text-muted-foreground">{t('premiumAccess')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="lg:ps-72">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card ps-4 pe-4 sm:pe-6 lg:ps-72">
          <Button
            ref={menuButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
          >
            <Menu size={20} />
          </Button>
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="rounded-full bg-muted ps-9 border-transparent focus-visible:border-ring"
            />
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground"
              aria-label={t('notifications')}
            >
              <Bell size={20} />
              <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>

            <div className="flex items-center gap-3">
              <div className="hidden text-end sm:block">
                <p className="font-body text-sm font-medium text-foreground">{displayName}</p>
                <p className="font-body text-xs text-muted-foreground">{user.role || 'Admin'}</p>
              </div>
              {user.image ? (
                <Image
                  src={user.image}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean-700 font-body text-xs font-semibold text-white">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-screen overflow-y-auto bg-muted/30 px-4 pb-8 pt-24 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
