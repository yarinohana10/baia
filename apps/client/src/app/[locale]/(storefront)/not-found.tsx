import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('storefront.notFound');
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-black leading-none text-ocean-200" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mt-4 max-w-md text-[17px] leading-relaxed text-gray-500">{t('body')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex rounded-lg bg-ocean-700 px-7 py-3.5 text-[15px] font-semibold text-white hover:bg-ocean-600">
          {t('home')}
        </Link>
        <Link
          href="/new-arrivals"
          className="inline-flex rounded-lg border border-gray-300 px-7 py-3.5 text-[15px] font-semibold text-gray-900 hover:border-ocean-500"
        >
          {t('shop')}
        </Link>
      </div>
    </section>
  );
}
