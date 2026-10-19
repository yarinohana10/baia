'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { whatsappHref } from '@/lib/site';
import { WhatsAppGlyph } from './WhatsAppGlyph';

/** Pages with their own bottom actions (payment, cart totals) - keep the corner clear there. */
const HIDDEN_ON = ['/checkout', '/cart', '/order-confirmation'];

/**
 * Floating WhatsApp chat button, bottom-start corner (right in Hebrew, left in
 * English) so it never sits on the cart drawer's side. Hidden when the admin
 * clears the WhatsApp number. Sits under drawers/overlays (z-40 < z-50).
 */
export function WhatsAppButton({ number }: { number: string | null }) {
  const t = useTranslations('legal.whatsapp');
  const pathname = usePathname();
  const href = whatsappHref(number, t('prefill'));
  if (!href || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  // Product pages may get a sticky add-to-cart bar on phones: lift the button above it.
  const onProduct = pathname.startsWith('/product/');

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('label')}
      title={t('label')}
      className={`fixed start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-700 print:hidden sm:start-6 ${
        onProduct ? 'bottom-24 sm:bottom-6' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6'
      }`}
    >
      <WhatsAppGlyph size={28} />
    </a>
  );
}
