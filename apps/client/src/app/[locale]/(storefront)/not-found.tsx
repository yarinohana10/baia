import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('storefront.notFound');
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-[96px] leading-none text-ocean-200 sm:text-[140px]" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl text-ink sm:text-5xl">{t('title')}</h1>
      <p className="mt-4 max-w-md text-[17px] leading-relaxed text-stone">{t('body')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex rounded-[2px] bg-ink px-7 py-3.5 text-[15px] font-semibold text-white hover:bg-coral">
          {t('home')}
        </Link>
        <Link
          href="/new-arrivals"
          className="inline-flex rounded-[2px] border border-ink/30 px-7 py-3.5 text-[15px] font-semibold text-ink hover:border-ink"
        >
          {t('shop')}
        </Link>
      </div>
    </section>
  );
}
