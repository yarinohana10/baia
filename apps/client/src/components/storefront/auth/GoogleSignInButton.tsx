'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useGoogleSignIn } from '@/hooks/storefront/useGoogleSignIn';
import { cn } from '@/lib/utils';
import { GoogleIcon } from './GoogleIcon';

/** "Sign in with Google" (login and register; `className` sets the page's corner style). */
export function GoogleSignInButton({ onError, className }: { onError: () => void; className: string }) {
  const t = useTranslations('auth');
  const [pending, start] = useGoogleSignIn(onError);
  return (
    <button
      type="button"
      onClick={start}
      disabled={pending}
      className={cn(
        'w-full flex items-center justify-center gap-3 border border-[#bec8cd] bg-white text-[#1a1c1c] font-body text-sm font-medium py-3.5 hover:bg-[#f9f9f9] hover:border-[#3f484c] transition-colors duration-300 disabled:opacity-70',
        className,
      )}
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <>
          <GoogleIcon />
          {t('signInWithGoogle')}
        </>
      )}
    </button>
  );
}
