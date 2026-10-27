import { describe, expect, it } from 'vitest';
import he from '../../../messages/he/catalog.json';
import en from '../../../messages/en/catalog.json';
import { colorKey, translateColor } from '../catalog/color-names';

/** Minimal stand-in for next-intl's `t` over one messages namespace. */
function translator(messages: Record<string, string>) {
  const t = (key: string) => messages[key];
  t.has = (key: string) => key in messages;
  return t;
}

describe('colour names', () => {
  it('turns a stored colour into a message key', () => {
    expect(colorKey('  Blue Stripe ')).toBe('blue_stripe');
    expect(colorKey('Light  Blue')).toBe('light_blue');
  });

  it('shows English colours in Hebrew on the Hebrew site', () => {
    const t = translator(he.colors);
    expect(translateColor(t, 'Blue')).toBe('כחול');
    expect(translateColor(t, 'Blue Stripe')).toBe('פסים כחולים');
  });

  it('shows Hebrew colours in English on the English site', () => {
    expect(translateColor(translator(en.colors), 'שחור')).toBe('Black');
  });

  it('falls back to the stored value for unknown colours', () => {
    const t = translator(he.colors);
    expect(translateColor(t, 'Sunset Haze')).toBe('Sunset Haze');
    expect(translateColor(t, 'a.b')).toBe('a.b');
  });

  it('has a Hebrew name for every English colour', () => {
    const english = Object.keys(en.colors).filter((k) => /^[a-z_]+$/.test(k));
    expect(english.filter((k) => !(k in he.colors))).toEqual([]);
  });
});
