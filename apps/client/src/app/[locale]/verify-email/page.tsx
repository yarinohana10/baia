'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import { useEmailVerification } from '@/hooks/storefront/useEmailVerification';
import {
  AuthAlert,
  AuthCardLayout,
  authButtonClass,
  authLinkClass,
} from '@/components/storefront/AuthCardLayout';

function VerifyEmail() {
  const t = useTranslations('auth');
  const token = useSearchParams().get('token');
  const { data: session, refetch } = useSession();
  const status = useEmailVerification(token, refetch);

  if (status === 'verifying') {
    return (
      <AuthCardLayout title={t('verifyEmailTitle')}>
        <div className="flex items-center gap-3 text-[#3f484c]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-body">{t('verifyingEmail')}</span>
        </div>
      </AuthCardLayout>
    );
  }

  if (status === 'error') {
    return (
      <AuthCardLayout title={t('verifyEmailTitle')}>
        <AuthAlert tone="error">{t('verifyLinkInvalid')}</AuthAlert>
        <Link href={session ? '/account' : '/login'} className={authButtonClass}>
          {session ? t('goToAccount') : t('signIn')}
        </Link>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout title={t('emailVerifiedTitle')}>
      <div className="flex items-start gap-3">
        <CheckCircle2 size={22} className="text-[#005d72] shrink-0 mt-0.5" />
        <p className="font-body text-base text-[#3f484c]">{t('emailVerified')}</p>
      </div>
      <Link href={session ? '/account' : '/'} className={authButtonClass}>
        {session ? t('goToAccount') : t('continueShopping')}
      </Link>
      {session && (
        <Link href="/" className={authLinkClass}>
          {t('continueShopping')}
        </Link>
      )}
    </AuthCardLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
