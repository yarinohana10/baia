import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Login / register page: brand photo on the left (desktop only), the form
 * column on the right with a back-to-home link, the mobile wordmark and the heading.
 */
export function AuthSplitLayout({
  hero,
  title,
  subtitle,
  children,
}: {
  /** Copy at the bottom of the photo. */
  hero: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('auth');
  return (
    <div className="flex min-h-screen bg-white [--radius:0px]">
      {/* Left: Hero Image (Desktop only) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <Image
          src="/hero/hero-banner.png"
          alt="BAIA Swimwear"
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-between p-16">
          <h2
            dir="ltr"
            className="font-display text-[56px] leading-[64px] tracking-[0.12em] text-white max-w-md drop-shadow-md"
          >
            BAIA SWIMWEAR
          </h2>
          {hero}
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Back to home */}
        <div className="p-5 sm:p-8 lg:p-12 lg:pb-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-black transition-colors"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            {t('backToHome')}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-5 sm:p-12 lg:p-24">
          <div className="w-full max-w-md flex flex-col space-y-12">
            {/* Mobile Brand (hidden on desktop) */}
            <div className="lg:hidden flex flex-col items-center">
              <h2 dir="ltr" className="font-display text-[40px] leading-[48px] tracking-[0.2em] text-black text-center">
                BAIA
              </h2>
            </div>

            {/* Heading */}
            <div className="flex flex-col space-y-4">
              <h1 className="text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{title}</h1>
              <p className="text-base leading-6 text-neutral-600">{subtitle}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
