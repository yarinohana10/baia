import { renderTemplate } from '../src/email/templates';

const data = {
  productName: 'בגד ים קלאסי',
  color: 'Black',
  size: 'M',
  sku: 'BAIA-1-M',
  remaining: 3,
  adminUrl: 'https://shop.example/he/admin/products/p1',
};

describe('stock alert emails', () => {
  it('renders the low-stock alert in Hebrew with product, color, size and remaining', () => {
    const mail = renderTemplate('admin-low-stock', { ...data, threshold: 5 }, 'he');
    expect(mail.subject).toBe('מלאי נמוך: בגד ים קלאסי / Black / M (נותרו 3)');
    for (const part of ['בגד ים קלאסי', 'Black', 'BAIA-1-M', data.adminUrl]) {
      expect(mail.html).toContain(part);
      expect(mail.text).toContain(part);
    }
    expect(mail.html).toContain('dir="rtl"');
  });

  it('renders the sold-out alert', () => {
    const mail = renderTemplate('admin-sold-out', { ...data, remaining: 0 }, 'he');
    expect(mail.subject).toBe('אזל המלאי: בגד ים קלאסי / Black / M');
    expect(mail.html).toContain('חוזר בקרוב');
  });

  it('stays Hebrew whatever the locale, and is not customer-facing', () => {
    const mail = renderTemplate('admin-sold-out', { ...data, remaining: 0 }, 'en');
    expect(mail.subject).toContain('אזל');
  });
});
