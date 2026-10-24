import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('storefront.notFound');
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-black leading-none text-neutral-300" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{t('title')}</h1>
      <p className="mt-4 max-w-md text-[17px] leading-relaxed text-gray-500">{t('body')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex rounded-none bg-black px-7 py-3.5 text-[15px] font-semibold text-white hover:bg-neutral-800">
          {t('home')}
        </Link>
        <Link
          href="/new-arrivals"
          className="inline-flex rounded-none border border-gray-300 px-7 py-3.5 text-[15px] font-semibold text-gray-900 hover:border-neutral-600"
        >
          {t('shop')}
        </Link>
      </div>
    </section>
  );
}
