'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Package, MapPin, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { VerifyEmailBanner } from '@/components/storefront/VerifyEmailBanner';
import { ProfileCard } from '@/components/storefront/account/ProfileCard';
import { PasswordCard } from '@/components/storefront/account/PasswordCard';

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

function AccountLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-ocean-300 hover:bg-ocean-50/30 transition-colors group mb-6"
    >
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-ocean-50 rounded-lg text-ocean-700">{icon}</div>
        <div>
          <p className="font-body text-base font-semibold text-[#1a1c1c]">{title}</p>
          <p className="font-body text-sm text-[#3f484c]">{description}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-400 group-hover:text-ocean-600 rtl:rotate-180 transition-colors" />
    </Link>
  );
}

export default function AccountPage() {
  const t = useTranslations('account');
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 flex justify-center">
        <Loader2 size={32} className="animate-spin text-ocean-600" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-[32px] leading-[40px] text-[#1a1c1c] mb-2">
          {t('title')}
        </h1>
        {user?.name && (
          <p className="font-body text-base text-[#3f484c]">
            {t('welcome')}, {user.name}
          </p>
        )}
      </div>

      {user && !user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {user && <ProfileCard name={user.name} email={user.email} />}

      <AccountLink
        href="/account/orders"
        icon={<Package size={20} strokeWidth={1.8} />}
        title={t('myOrders')}
        description={t('myOrdersDescription')}
      />

      <AccountLink
        href="/account/addresses"
        icon={<MapPin size={20} strokeWidth={1.8} />}
        title={t('myAddresses')}
        description={t('myAddressesDescription')}
      />

      {user && <PasswordCard />}

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 w-full py-3.5 border border-gray-200 rounded-xl font-body text-sm font-semibold text-[#3f484c] hover:border-ocean-300 hover:text-ocean-700 hover:bg-ocean-50/30 transition-colors"
      >
        <LogOut size={16} strokeWidth={1.8} />
        {t('signOut')}
      </button>
    </div>
  );
}
