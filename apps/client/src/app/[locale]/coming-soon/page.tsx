import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getLogoUrl } from '@/lib/brand';
import { comingSoonEnabled } from '@/lib/coming-soon';
import { Link } from '@/i18n/navigation';
import { SOCIAL_LINKS } from '@/lib/site';
import { FacebookGlyph, InstagramGlyph, TikTokGlyph } from '@/components/storefront/SocialGlyphs';

const SOCIAL_GLYPHS = { instagram: InstagramGlyph, tiktok: TikTokGlyph, facebook: FacebookGlyph };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'comingSoon' });
  return { title: { absolute: t('metaTitle') }, description: t('body'), robots: { index: false, follow: false } };
}

/**
 * What shoppers see while the admin "Coming Soon" switch is on: a plain white page
 * with the logo, the message and the social links. The middleware rewrites every
 * storefront address here; Admins never get it. Opened directly once the switch
 * is off, it sends the visitor to the store.
 */
export default async function ComingSoonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await comingSoonEnabled())) redirect(`/${locale}`);

  const t = await getTranslations('comingSoon');

  return (
    <div className="flex min-h-svh flex-col bg-white text-black">
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo host is runtime config (LOGO_URL) */}
        <img src={getLogoUrl()} alt="BAIA Swimwear" className="h-16 w-auto sm:h-20" />

        <h1 className="mt-8 font-display text-[44px] leading-[1.05] tracking-[0.08em] sm:text-[72px] lg:text-[88px]">
          {t('title')}
        </h1>
        <p className="mt-6 max-w-md text-base font-light leading-7 text-black/70 sm:text-lg">{t('body')}</p>

        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/60">{t('follow')}</p>
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
                    className="flex size-11 items-center justify-center rounded-full border border-black/20 text-black/80 transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-700"
                  >
                    <Glyph size={20} />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </main>

      <footer className="flex flex-col items-center gap-1 px-4 pb-6 text-center text-xs text-black/50">
        {/* Admins land here too before signing in; the login page has Google and email. */}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center px-3 font-medium text-black/60 underline-offset-4 hover:text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-700"
        >
          {t('signIn')}
        </Link>
        <p>© {new Date().getFullYear()} BAIA Swimwear</p>
      </footer>
    </div>
  );
}
