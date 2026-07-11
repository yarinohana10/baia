import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-ocean-700 text-white py-32 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-light tracking-widest mb-4">
            {tCommon('brandName')}
          </h1>
          <p className="text-xl md:text-2xl font-light mb-2">
            {t('heroTitle')}
          </p>
          <p className="text-lg text-white/80 mb-8">
            {t('heroSubtitle')}
          </p>
          <a
            href="#"
            className="inline-block bg-sand-400 text-ocean-900 px-8 py-3 text-sm font-medium tracking-wider uppercase hover:bg-sand-300 transition-colors"
          >
            {t('heroCta')}
          </a>
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto py-16 px-6">
        <h2 className="text-2xl font-light text-center tracking-wider mb-12">
          {t('categoriesTitle')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {['men', 'women', 'children'].map((category) => (
            <div
              key={category}
              className="group relative aspect-[3/4] bg-ocean-50 overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-ocean-700/20 group-hover:bg-ocean-700/40 transition-colors z-10" />
              <div className="absolute inset-0 flex items-end justify-center pb-8 z-20">
                <span className="text-white text-xl font-light tracking-widest uppercase">
                  {category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
