import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getLogoUrl } from '@/lib/brand';
import { getSiteConfig } from '@/lib/catalog/server';
import { comingSoonEnabled } from '@/lib/coming-soon';
import { SOCIAL_LINKS } from '@/lib/site';
import { FacebookGlyph, InstagramGlyph, TikTokGlyph } from '@/components/storefront/SocialGlyphs';

const SOCIAL_GLYPHS = {
  instagram: InstagramGlyph,
  tiktok: TikTokGlyph,
  facebook: FacebookGlyph,
};
const HERO_FALLBACK = '/hero/hero-banner.png';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'comingSoon' });
  return {
    title: { absolute: t('metaTitle') },
    description: t('body'),
    robots: { index: false, follow: false },
  };
}

/**
 * What shoppers see while the admin "Coming Soon" switch is on. The middleware
 * rewrites every storefront address here; Admins never get it. Opened directly
 * once the switch is off, it sends the visitor to the store.
 */
export default async function ComingSoonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await comingSoonEnabled())) redirect(`/${locale}`);

  const [t, config] = await Promise.all([getTranslations('comingSoon'), getSiteConfig()]);
  const heroUrl = config?.heroImageUrl || HERO_FALLBACK;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-ocean-900 text-white">
      <Image src={heroUrl} alt="" fill priority sizes="100vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/60" aria-hidden="true" />

      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-xl flex-col items-center bg-black/40 px-6 py-10 text-center backdrop-blur-md sm:px-12 sm:py-14">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo host is runtime config (LOGO_URL) */}
          <img src={getLogoUrl()} alt="BAIA Swimwear" className="h-14 w-auto brightness-0 invert sm:h-16" />

          <h1 className="mt-8 font-display text-[44px] leading-[1.05] tracking-[0.08em] sm:text-[72px] lg:text-[88px]">
            {t('title')}
          </h1>
          <p className="mt-6 max-w-md text-base font-light leading-7 text-white/90 sm:text-lg">{t('body')}</p>

          <div className="mt-10">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/75">{t('follow')}</p>
            <ul className="mt-3 flex items-center justify-center gap-2">
              {SOCIAL_LINKS.map(({ id, name, href }) => {
                const Glyph = SOCIAL_GLYPHS[id];
                return (
                  <li key={id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener"
                      aria-label={t('followOn', { network: name })}
                      title={name}
                      className="flex size-11 items-center justify-center rounded-full border border-white/40 transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <Glyph size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-4 pb-6 text-center text-xs text-white/70">
        © {new Date().getFullYear()} BAIA Swimwear
      </footer>
    </div>
  );
}
