import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Truck, Shield, RotateCcw } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  return (
    <footer className="bg-ocean-700 text-white">
      {/* Trust badges */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <Truck size={28} strokeWidth={1.5} />
              <span className="text-sm tracking-wider">{t('freeShipping')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield size={28} strokeWidth={1.5} />
              <span className="text-sm tracking-wider">{t('securePayment')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <RotateCcw size={28} strokeWidth={1.5} />
              <span className="text-sm tracking-wider">{t('easyReturns')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-light tracking-[0.3em] mb-4">BAIA</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Premium swimwear for the whole family.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-medium tracking-widest uppercase mb-4 text-white/80">
              {tNav('women') === 'נשים' ? 'קטגוריות' : 'Categories'}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/category/men" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('men')}
                </Link>
              </li>
              <li>
                <Link href="/category/women" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women')}
                </Link>
              </li>
              <li>
                <Link href="/category/children" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('children')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-xs font-medium tracking-widest uppercase mb-4 text-white/80">
              {tNav('women') === 'נשים' ? 'עזרה' : 'Help'}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/shipping" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women') === 'נשים' ? 'מדיניות משלוחים' : 'Shipping Policy'}
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women') === 'נשים' ? 'החזרות והחלפות' : 'Returns & Exchanges'}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women') === 'נשים' ? 'צור קשר' : 'Contact Us'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-medium tracking-widest uppercase mb-4 text-white/80">
              {tNav('women') === 'נשים' ? 'חשבון' : 'Account'}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women') === 'נשים' ? 'התחברות' : 'Login'}
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-white/60 hover:text-white transition-colors">
                  {tNav('women') === 'נשים' ? 'הרשמה' : 'Register'}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-white/40 tracking-wider">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
