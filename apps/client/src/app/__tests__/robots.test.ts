import { describe, expect, it } from 'vitest';
import robots from '../robots';

describe('robots.txt', () => {
  const rules = robots().rules;
  const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow as string[];

  it('keeps token-bearing order pages out of search engines, in every locale', () => {
    for (const path of ['/order-status', '/cancel-order', '/order-confirmation', '/admin', '/checkout']) {
      expect(disallow).toContain(path);
      expect(disallow).toContain(`/he${path}`);
      expect(disallow).toContain(`/en${path}`);
    }
  });
});
