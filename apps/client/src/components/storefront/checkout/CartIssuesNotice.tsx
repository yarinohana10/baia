import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** Some cart lines can't be ordered as they are: fix them in the cart first. */
export function CartIssuesNotice() {
  const t = useTranslations('cart');
  const tCheckout = useTranslations('checkout');
  return (
    <p role="status" className="text-xs text-red-500 flex items-start gap-1.5">
      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
      <span>
        {t('issues.blocked')}{' '}
        <Link href="/cart" className="underline hover:text-red-600">
          {tCheckout('backToCart')}
        </Link>
      </span>
    </p>
  );
}
