import type { EmailLocale, RenderedEmail } from '../email.types';
import { defaultLayoutContext, renderLayout, renderText, type LayoutContext, type LayoutParts } from './layout';

export function render(parts: LayoutParts, subject: string, ctx: LayoutContext = defaultLayoutContext()): RenderedEmail {
  return { subject, html: renderLayout(parts, ctx), text: renderText(parts, ctx) };
}

export function greeting(locale: EmailLocale, name?: string | null): string {
  const n = name?.trim();
  if (locale === 'he') return n ? `שלום ${n},` : 'שלום,';
  return n ? `Hi ${n},` : 'Hi,';
}

/** How an order was paid (filled by the payment flow; every field optional). */
export interface PaymentInfo {
  method?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  installments?: number | null;
}

const CARD_BRANDS: Record<string, { he: string; en: string }> = {
  visa: { he: 'ויזה', en: 'Visa' },
  mastercard: { he: 'מאסטרקארד', en: 'Mastercard' },
  amex: { he: 'אמריקן אקספרס', en: 'American Express' },
  americanexpress: { he: 'אמריקן אקספרס', en: 'American Express' },
  isracard: { he: 'ישראכרט', en: 'Isracard' },
  diners: { he: 'דיינרס', en: 'Diners' },
  discover: { he: 'דיסקבר', en: 'Discover' },
};

/**
 * "ויזה •••• 4242 · 3 תשלומים" / "Bit" / "Apple Pay". Null when nothing is
 * known (older orders), so the payment box is simply left out.
 */
export function paymentLines(p: PaymentInfo | null | undefined, locale: EmailLocale): string[] | null {
  if (!p) return null;
  const he = locale === 'he';
  const method = p.method?.toLowerCase().replace(/[\s-]/g, '_') ?? null;
  const lines: string[] = [];
  if (method === 'bit') lines.push('Bit');
  else if (method === 'apple_pay') lines.push(p.cardLast4 ? `Apple Pay · •••• ${p.cardLast4}` : 'Apple Pay');
  else if (method === 'google_pay') lines.push('Google Pay');
  else if (p.cardBrand || p.cardLast4 || method === 'card') {
    const key = p.cardBrand?.toLowerCase().replace(/[\s_-]/g, '') ?? '';
    const brand = CARD_BRANDS[key]?.[locale] ?? p.cardBrand?.trim() ?? (he ? 'כרטיס אשראי' : 'Credit card');
    lines.push(p.cardLast4 ? `${brand} •••• ${p.cardLast4}` : brand);
  }
  if (!lines.length) return null;
  const n = p.installments ?? 0;
  if (n > 1) lines[0] += he ? ` · ${n} תשלומים` : ` · ${n} installments`;
  else if (n === 1 && lines.length) lines[0] += he ? ' · תשלום אחד' : ' · single payment';
  return lines;
}
