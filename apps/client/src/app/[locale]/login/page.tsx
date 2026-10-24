'use client';

import { useTranslations } from 'next-intl';
import { AuthSplitLayout } from '@/components/storefront/auth/AuthSplitLayout';
import { LoginForm } from '@/components/storefront/auth/LoginForm';

export default function LoginPage() {
  const t = useTranslations('auth');
  return (
    <AuthSplitLayout
      hero={
        <p className="text-lg leading-7 text-white/90 max-w-sm font-light drop-">
          {t('heroLoginSubtitle')}
        </p>
      }
      title={t('welcomeBack')}
      subtitle={t('signInSubtitle')}
    >
      <LoginForm />
    </AuthSplitLayout>
  );
}
