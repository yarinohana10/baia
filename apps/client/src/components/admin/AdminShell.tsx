'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  Bell,
  Search,
  Shield,
  ArrowLeft,
  Menu,
  X,
  Undo2,
  Mail,
  Newspaper,
  Truck,
  UserCog,
  Ruler,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Wordmark } from '@/components/storefront/Wordmark';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type AdminUser = {
  name?: string | null;
  email: string;
  role?: string;
  image?: string | null;
};

/** Badge counts from GET /admin/notifications/counts. */
export type AdminCounts = {
  pendingCancellations: number;
  newContactMessages: number;
  newOrders: number;
  ordersToFulfil?: number;
};

type CountKey = 'pendingCancellations' | 'newContactMessages' | 'newOrders';

const navItems: {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: CountKey;
}[] = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingBag, badge: 'newOrders' },
  { href: '/admin/cancellations', labelKey: 'cancellations', icon: Undo2, badge: 'pendingCancellations' },
  { href: '/admin/messages', labelKey: 'messages', icon: Mail, badge: 'newContactMessages' },
  { href: '/admin/customers', labelKey: 'customers', icon: Users },
  { href: '/admin/products', labelKey: 'products', icon: Package },
  { href: '/admin/categories', labelKey: 'categories', icon: FolderTree },
  { href: '/admin/size-guides', labelKey: 'sizeGuides', icon: Ruler },
  { href: '/admin/coupons', labelKey: 'coupons', icon: Tags },
  { href: '/admin/delivery', labelKey: 'delivery', icon: Truck },
  { href: '/admin/newsletter', labelKey: 'newsletter', icon: Newspaper },
  { href: '/admin/admins', labelKey: 'admins', icon: UserCog },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
];

const POLL_MS = 60_000;

/** Polls the admin badge counts every minute (and when the tab regains focus). */
function useAdminCounts(pathname: string) {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const load = useCallback(() => {
    api
      .get<AdminCounts>('/admin/notifications/counts')
      .then((res) => setCounts(res.data))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);
  // Handling an item on one page should clear its badge soon after navigating.
  useEffect(() => {
    load();
  }, [pathname, load]);
  return counts;
}

function CountBadge({ count, active, label }: { count: number; active?: boolean; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className={cn(
        'ms-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5',
        active ? 'bg-white text-ocean-700' : 'bg-destructive text-white',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AdminShell({
  user,
  logoUrl,
  children,
}: {
  user: AdminUser;
  logoUrl?: string;
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
  const counts = useAdminCounts(pathname);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const totalAlerts = counts ? counts.pendingCancellations + counts.newContactMessages + counts.newOrders : 0;

  useEffect(() => {
    setMenuOpen(false);
    setBellOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBellOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [bellOpen]);

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
          <div className="flex items-center gap-3">
            <Wordmark src={logoUrl} className="h-14" />
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
                {item.badge && counts && (
                  <CountBadge
                    count={counts[item.badge]}
                    active={isActive}
                    label={t('alerts.badge', { count: counts[item.badge] })}
                  />
                )}
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
            <div ref={bellRef} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground"
                aria-label={totalAlerts > 0 ? t('alerts.bellWithCount', { count: totalAlerts }) : t('notifications')}
                aria-haspopup="true"
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((open) => !open)}
              >
                <Bell size={20} />
                {totalAlerts > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
                    {totalAlerts > 99 ? '99+' : totalAlerts}
                  </span>
                )}
              </Button>
              {bellOpen && (
                <div className="absolute end-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
                  <p className="px-3 py-2 font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('alerts.title')}
                  </p>
                  {totalAlerts === 0 ? (
                    <p className="px-3 py-4 text-center font-body text-sm text-muted-foreground">{t('alerts.empty')}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {(
                        [
                          { key: 'newOrders', href: '/admin/orders?status=CONFIRMED', icon: ShoppingBag },
                          { key: 'pendingCancellations', href: '/admin/cancellations', icon: Undo2 },
                          { key: 'newContactMessages', href: '/admin/messages', icon: Mail },
                        ] as const
                      )
                        .filter((row) => (counts?.[row.key] ?? 0) > 0)
                        .map((row) => (
                          <li key={row.key}>
                            <Link
                              href={row.href}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm text-foreground hover:bg-muted"
                            >
                              <row.icon size={16} className="text-ocean-700" />
                              <span className="flex-1">{t(`alerts.${row.key}`, { count: counts?.[row.key] ?? 0 })}</span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

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
