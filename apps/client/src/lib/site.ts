import type { SiteConfig } from './catalog/types';
import { LOW_STOCK_THRESHOLD, formatPrice } from './catalog/pricing';

/**
 * Store contact details shown on the Contact page and in structured data.
 * The live values come from the admin site settings (GET /site-config); this is
 * only the fallback when the API is unreachable.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'baiaswimwear0@gmail.com';

/** ח.פ. value meaning "company not registered yet" (schema default). */
export const COMPANY_ID_PLACEHOLDER = '000000000';

/** Business/delivery details the storefront needs, with schema defaults as fallback. */
export type BusinessInfo = {
  businessName: string;
  companyId: string | null;
  businessAddress: string;
  businessPhone: string;
  contactEmail: string;
  whatsappNumber: string | null;
  accessibilityCoordinatorName: string;
  accessibilityCoordinatorPhone: string;
  accessibilityCoordinatorEmail: string;
  lowStockThreshold: number;
  courierCost: string;
  pickupCost: string;
  freeShippingThreshold: string;
  courierEtaDays: string;
  pickupEtaDays: string;
};

const num = (value: string | null | undefined, fallback: number) => {
  const n = value == null ? NaN : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Normalises the (possibly missing) site config into display-ready values. */
export function businessInfo(config: SiteConfig | null | undefined): BusinessInfo {
  const companyId = config?.companyId?.trim() || COMPANY_ID_PLACEHOLDER;
  return {
    businessName: config?.businessName || 'BAIA Swimwear',
    companyId: companyId === COMPANY_ID_PLACEHOLDER ? null : companyId,
    businessAddress: config?.businessAddress || 'מושב גילת',
    businessPhone: config?.businessPhone || '050-0000000',
    contactEmail: config?.contactEmail || CONTACT_EMAIL,
    whatsappNumber: config ? config.whatsappNumber : null,
    accessibilityCoordinatorName: config?.accessibilityCoordinatorName || '',
    accessibilityCoordinatorPhone: config?.accessibilityCoordinatorPhone || config?.businessPhone || '',
    accessibilityCoordinatorEmail: config?.accessibilityCoordinatorEmail || config?.contactEmail || CONTACT_EMAIL,
    lowStockThreshold: config?.lowStockThreshold ?? LOW_STOCK_THRESHOLD,
    courierCost: formatPrice(num(config?.shippingCost, 29.9)),
    pickupCost: formatPrice(num(config?.pickupPointCost, 19.9)),
    freeShippingThreshold: formatPrice(num(config?.freeShippingThreshold, 249)),
    courierEtaDays: config?.courierEtaDays || '3-5',
    pickupEtaDays: config?.pickupEtaDays || '2-4',
  };
}

/** `tel:` href from a display phone ("050-123 4567" -> "tel:0501234567"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** wa.me deep link with a prefilled message; null when WhatsApp is disabled or the number is invalid. */
export function whatsappHref(number: string | null | undefined, text?: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Replaces `{name}` placeholders in raw (t.raw) legal copy. Unknown keys are left as-is. */
export function fillTemplate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Date the legal pages were last revised (shown on terms / privacy / accessibility). */
export const LEGAL_UPDATED_AT = '2026-10-19';
