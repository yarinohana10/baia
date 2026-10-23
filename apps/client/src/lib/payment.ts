/**
 * Payment page helpers: card validation and formatting (client-side only),
 * the mock provider's test cards, and how a paid order's method is shown.
 *
 * PCI boundary: the full card number, CVV, expiry and the cardholder's ID
 * number stay in the browser. The API only ever receives `PayRequest`.
 */

export type PaymentMethod = 'card' | 'bit' | 'apple_pay';
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'isracard' | 'diners';
export type PaymentSimulation = 'success' | 'decline' | 'insufficient_funds' | '3ds';
export type DeclineCode = 'card_declined' | 'insufficient_funds' | 'provider_error' | 'declined';

/** GET /payment/config */
export type PaymentConfig = {
  /** PAYMENTS_ENABLED on the server. Off: the shop is browsable but cannot take orders ("Payments coming soon"). */
  enabled: boolean;
  provider: string;
  testMode: boolean;
  methods: PaymentMethod[];
  installments: { max: number; minTotal: number };
};

/**
 * The test banner and test cards are for the mock provider only: whatever the
 * server says, a real provider never shows test UI.
 */
export function normalizePaymentConfig(config: PaymentConfig): PaymentConfig {
  return { ...config, testMode: config.testMode && config.provider === 'mock' };
}

/** Body of POST /orders/:id/pay — nothing that could identify the card. */
export type PayRequest = {
  method: PaymentMethod;
  installments?: number;
  simulation?: PaymentSimulation;
  cardBrand?: CardBrand;
  cardLast4?: string;
};

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** Luhn (mod 10) checksum used by international card numbers. */
export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Isracard's domestic 8–9 digit cards use a weighted mod 11 check, not Luhn. */
export function isracardValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 8 || digits.length > 9) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(padded[i]) * (9 - i);
  return sum % 11 === 0;
}

/** Brand from the leading digits (null while unknown). */
export function detectCardBrand(number: string): CardBrand | null {
  const d = digitsOnly(number);
  if (!d) return null;
  if (/^3[47]/.test(d)) return 'amex';
  if (/^3(0[0-5]|[689])/.test(d)) return 'diners';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2(2[1-9]|[3-9]\d)|[3-6]\d\d|7([01]\d|20)))/.test(d)) return 'mastercard';
  // Domestic Isracard numbers are short and have no international prefix.
  if (d.length >= 8 && d.length <= 9) return 'isracard';
  return null;
}

const LENGTHS: Record<CardBrand, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
  amex: [15],
  diners: [14, 16],
  isracard: [8, 9],
};

export function cardMaxLength(brand: CardBrand | null): number {
  return brand ? Math.max(...LENGTHS[brand]) : 19;
}

export function cvvLength(brand: CardBrand | null): number {
  return brand === 'amex' ? 4 : 3;
}

export function cardNumberValid(number: string): boolean {
  const digits = digitsOnly(number);
  const brand = detectCardBrand(digits);
  if (!brand || !LENGTHS[brand].includes(digits.length)) return false;
  return brand === 'isracard' ? isracardValid(digits) : luhnValid(digits);
}

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex 4-6-5, Diners 4-6-4). */
export function formatCardNumber(value: string): string {
  const brand = detectCardBrand(value);
  const digits = digitsOnly(value).slice(0, cardMaxLength(brand));
  const groups = brand === 'amex' || (brand === 'diners' && digits.length <= 14) ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const parts: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return parts.join(' ');
}

/** "1230" -> "12/30"; "1" -> "1"; "13" -> "1" (month cannot start with 13). */
export function formatExpiry(value: string): string {
  let digits = digitsOnly(value).slice(0, 4);
  // A leading digit 2-9 can only be a single-digit month.
  if (/^[2-9]/.test(digits)) digits = `0${digits}`.slice(0, 4);
  if (digits.length >= 2 && (Number(digits.slice(0, 2)) > 12 || digits.slice(0, 2) === '00')) {
    digits = digits.slice(0, 1);
  }
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** MM/YY, not in the past (the card is valid through the end of its month). */
export function expiryValid(value: string, now = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const endOfMonth = new Date(year, month, 1); // first day of the following month
  return endOfMonth > now && year <= now.getFullYear() + 20;
}

/** Israeli ID number (ת.ז.) check digit: weights 1,2,1,2… with digit-summing. */
export function israeliIdValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 5 || digits.length > 9 || digits !== value.trim()) return false;
  if (/^0+$/.test(digits)) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(padded[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

/** Israeli mobile number for Bit: 05X-XXXXXXX. */
export function israeliMobileValid(value: string): boolean {
  return /^05\d{8}$/.test(digitsOnly(value));
}

export function formatIsraeliMobile(value: string): string {
  const d = digitsOnly(value).slice(0, 10);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}

/** The mock provider's test cards (shown on the page only in test mode). */
export const TEST_CARDS: { number: string; simulation: PaymentSimulation }[] = [
  { number: '4242424242424242', simulation: 'success' },
  { number: '4000000000000002', simulation: 'decline' },
  { number: '4000000000009995', simulation: 'insufficient_funds' },
  { number: '4000000000003220', simulation: '3ds' },
];

/** Outcome the mock should produce for this card; any other valid card succeeds. */
export function simulationForCard(number: string): PaymentSimulation {
  const digits = digitsOnly(number);
  return TEST_CARDS.find((c) => c.number === digits)?.simulation ?? 'success';
}

/** Installment choices for an order total (just [1] below the minimum). */
export function installmentOptions(total: number, config: PaymentConfig['installments'] | undefined): number[] {
  if (!config || total < config.minTotal || config.max <= 1) return [1];
  return Array.from({ length: config.max }, (_, i) => i + 1);
}

/** The safe-to-send summary of a card payment. */
export function cardPayRequest(
  number: string,
  installments: number,
  opts: { testMode: boolean; simulation?: PaymentSimulation },
): PayRequest {
  const digits = digitsOnly(number);
  const brand = detectCardBrand(digits);
  return {
    method: 'card',
    installments,
    ...(brand ? { cardBrand: brand } : {}),
    cardLast4: digits.slice(-4),
    ...(opts.testMode ? { simulation: opts.simulation ?? simulationForCard(digits) } : {}),
  };
}

/** Fields a paid order carries (see the server's Order model). */
export type OrderPaymentFields = {
  paymentMethod?: string | null;
  paymentInstallments?: number | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

/** A translation key under `payment.summary` plus its values, or null when nothing was recorded. */
export function paymentSummary(order: OrderPaymentFields): { key: string; values: Record<string, string | number> } | null {
  if (order.paymentMethod === 'bit') return { key: 'bit', values: {} };
  if (order.paymentMethod === 'apple_pay') return { key: 'applePay', values: {} };
  if (order.paymentMethod !== 'card') return null;
  const brand = order.cardBrand && ['visa', 'mastercard', 'amex', 'isracard', 'diners'].includes(order.cardBrand) ? order.cardBrand : 'other';
  const installments = order.paymentInstallments ?? 1;
  const last4 = order.cardLast4 ?? '';
  return { key: installments > 1 ? 'cardInstallments' : 'card', values: { brand, last4, installments } };
}
