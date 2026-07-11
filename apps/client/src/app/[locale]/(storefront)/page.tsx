import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function HomePage() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-ocean-700 text-white py-24 md:py-32 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-800/50 to-ocean-700/80" />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-extralight tracking-[0.4em] mb-4">
            {tCommon('brandName')}
          </h1>
          <div className="w-16 h-px bg-sand-400 mx-auto mb-6" />
          <p className="text-xl md:text-2xl font-light mb-2 tracking-wider">
            {t('heroTitle')}
          </p>
          <p className="text-base text-white/70 mb-10">
            {t('heroSubtitle')}
          </p>
          <Link
            href="/category/women"
            className="inline-block bg-sand-400 text-ocean-900 px-10 py-3.5 text-sm font-medium tracking-[0.2em] uppercase hover:bg-sand-300 transition-colors"
          >
            {t('heroCta')}
          </Link>
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto py-20 px-4 sm:px-6">
        <h2 className="text-2xl font-light text-center tracking-[0.2em] uppercase mb-12">
          {t('categoriesTitle')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { slug: 'men', label: tNav('men') },
            { slug: 'women', label: tNav('women') },
            { slug: 'children', label: tNav('children') },
          ].map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group relative aspect-[3/4] bg-ocean-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/60 via-ocean-900/20 to-transparent group-hover:from-ocean-900/70 transition-all z-10" />
              <div className="absolute inset-0 bg-ocean-100 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-end justify-center pb-10 z-20">
                <div className="text-center">
                  <span className="text-white text-xl font-light tracking-[0.3em] uppercase">
                    {category.label}
                  </span>
                  <div className="w-8 h-px bg-sand-400 mx-auto mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Placeholder */}
      <section className="bg-ocean-50/50 py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-light text-center tracking-[0.2em] uppercase mb-12">
            {t('featuredTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="group">
                <div className="aspect-[3/4] bg-white mb-3 overflow-hidden">
                  <div className="w-full h-full bg-gray-100 group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-sm text-gray-400 text-center tracking-wider">
                  Coming Soon
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sale Section Placeholder */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-light text-center tracking-[0.2em] uppercase mb-12">
            {t('saleTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="group">
                <div className="aspect-[3/4] bg-white mb-3 overflow-hidden relative">
                  <div className="absolute top-2 start-2 bg-red-500 text-white text-xs px-2 py-0.5 tracking-wider z-10">
                    SALE
                  </div>
                  <div className="w-full h-full bg-gray-100 group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-sm text-gray-400 text-center tracking-wider">
                  Coming Soon
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
