import { formatPrice } from '@/lib/catalog/pricing';

/** Formats an API decimal string (or number) as a price. */
export function money(value: string | number): string {
  return formatPrice(Number(value));
}
