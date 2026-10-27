/**
 * Variant colours are free text typed in the admin (usually English, e.g. "Blue Stripe").
 * The storefront shows them in the page language through the `colors` messages
 * (messages/<locale>/catalog.json); a colour with no entry is shown as typed.
 */

/** Message key for a colour: "Blue Stripe" -> "blue_stripe". */
export function colorKey(color: string): string {
  return color.trim().toLowerCase().replace(/\s+/g, '_');
}

type ColorTranslator = { has: (key: string) => boolean; (key: string): string };

/** Colour name in the translator's language, falling back to the stored value. */
export function translateColor(t: ColorTranslator, color: string): string {
  const key = colorKey(color);
  return key && !key.includes('.') && t.has(key) ? t(key) : color;
}
