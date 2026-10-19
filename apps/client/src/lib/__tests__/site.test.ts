import { describe, expect, it } from 'vitest';
import { businessInfo, fillTemplate, telHref, whatsappHref } from '../site';
import { parseConsent } from '../consent';
import type { SiteConfig } from '../catalog/types';

const config = (over: Partial<SiteConfig> = {}): SiteConfig => ({
  shippingCost: '29.90',
  freeShippingThreshold: '249',
  heroImageUrl: null,
  heroTitleHe: null,
  heroTitleEn: null,
  heroSubtitleHe: null,
  heroSubtitleEn: null,
  heroCtaUrl: null,
  pickupPointCost: '19.90',
  courierEtaDays: '3-5',
  pickupEtaDays: '2-4',
  businessName: 'BAIA Swimwear',
  companyId: '000000000',
  businessAddress: 'מושב גילת',
  businessPhone: '050-0000000',
  contactEmail: 'hello@baia.test',
  whatsappNumber: '972500000000',
  accessibilityCoordinatorName: 'דנה',
  accessibilityCoordinatorPhone: '050-1111111',
  accessibilityCoordinatorEmail: 'a11y@baia.test',
  selfCancelWindowHours: 48,
  ...over,
});

describe('businessInfo', () => {
  it('treats the placeholder company id as "not registered yet"', () => {
    expect(businessInfo(config()).companyId).toBeNull();
    expect(businessInfo(config({ companyId: '516123456' })).companyId).toBe('516123456');
  });

  it('formats delivery prices and falls back to defaults without a config', () => {
    const info = businessInfo(config({ shippingCost: '35', pickupPointCost: '19.90' }));
    expect(info.courierCost).toBe('₪35');
    expect(info.pickupCost).toBe('₪19.90');
    expect(info.freeShippingThreshold).toBe('₪249');

    const fallback = businessInfo(null);
    expect(fallback.whatsappNumber).toBeNull();
    expect(fallback.selfCancelWindowHours).toBe(48);
    expect(fallback.contactEmail).toMatch(/@/);
  });
});

describe('links', () => {
  it('builds tel: and wa.me links', () => {
    expect(telHref('050-123 4567')).toBe('tel:0501234567');
    expect(whatsappHref('972501234567', 'היי BAIA')).toBe(`https://wa.me/972501234567?text=${encodeURIComponent('היי BAIA')}`);
    expect(whatsappHref(null)).toBeNull();
    expect(whatsappHref('050')).toBeNull();
  });
});

describe('fillTemplate', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(fillTemplate('{a} and {b}', { a: 'x' })).toBe('x and {b}');
    expect(fillTemplate('{n} hours', { n: 48 })).toBe('48 hours');
  });
});

describe('parseConsent', () => {
  it('reads the baia_consent cookie', () => {
    expect(parseConsent('a=1; baia_consent=all; b=2')).toBe('all');
    expect(parseConsent('baia_consent=essential')).toBe('essential');
    expect(parseConsent('baia_consent=bogus')).toBeNull();
    expect(parseConsent('')).toBeNull();
  });
});
