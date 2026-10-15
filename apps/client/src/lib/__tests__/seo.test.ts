import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, breadcrumbJsonLd, jsonLd, languageAlternates, pageMetadata } from '../seo';

afterEach(() => vi.unstubAllEnvs());

describe('seo helpers', () => {
  it('builds locale-prefixed absolute URLs from NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.example');
    expect(absoluteUrl('he')).toBe('https://baia.example/he');
    expect(absoluteUrl('en', '/category/men')).toBe('https://baia.example/en/category/men');
  });

  it('returns hreflang alternates for every locale plus x-default (Hebrew)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.example');
    expect(languageAlternates('/shipping')).toEqual({
      he: 'https://baia.example/he/shipping',
      en: 'https://baia.example/en/shipping',
      'x-default': 'https://baia.example/he/shipping',
    });
  });

  it('pageMetadata sets canonical, alternates, OG and twitter', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.example');
    const meta = pageMetadata({
      locale: 'en',
      path: '/category/women',
      title: 'Women',
      description: 'desc',
      images: [{ url: 'https://cdn/x.jpg', alt: 'x' }],
    });
    expect(meta.title).toBe('Women');
    expect(meta.alternates?.canonical).toBe('https://baia.example/en/category/women');
    expect(meta.alternates?.languages).toMatchObject({ he: 'https://baia.example/he/category/women' });
    expect(meta.openGraph).toMatchObject({ url: 'https://baia.example/en/category/women', locale: 'en_US' });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: ['https://cdn/x.jpg'] });
    expect(meta.robots).toBeUndefined();
  });

  it('supports absolute titles and noindex', () => {
    const meta = pageMetadata({ locale: 'he', path: '/', title: 'BAIA', description: 'd', absoluteTitle: true, noIndex: true });
    expect(meta.title).toEqual({ absolute: 'BAIA' });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('escapes < in JSON-LD so it cannot close the script tag', () => {
    expect(jsonLd({ name: '</script><b>' })).not.toContain('</script>');
  });

  it('numbers breadcrumb positions from 1', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: 'a' },
      { name: 'Men', url: 'b' },
    ]);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
});
