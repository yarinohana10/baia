import { describe, expect, it } from 'vitest';
import { sameAddress, toInput, toPayload, type Address } from '../addresses';

const saved: Address = {
  id: 'a1',
  recipientName: 'Dana Levi',
  phone: '050-1234567',
  city: 'Tel Aviv',
  street: 'Dizengoff',
  number: '1',
  apartment: null,
  zip: '6433201',
  isDefault: true,
};

describe('sameAddress', () => {
  it('matches the saved values, ignoring case and extra spaces', () => {
    expect(sameAddress(saved, { ...toInput(saved), city: ' tel  aviv ' })).toBe(true);
  });

  it('treats a missing apartment and an empty one as equal', () => {
    expect(sameAddress(saved, { ...toInput(saved), apartment: '' })).toBe(true);
    expect(sameAddress(saved, { ...toInput(saved), apartment: '3' })).toBe(false);
  });

  it('differs when any field differs', () => {
    expect(sameAddress(saved, { ...toInput(saved), phone: '052-0000000' })).toBe(false);
    expect(sameAddress(saved, { ...toInput(saved), recipientName: 'Noa' })).toBe(false);
  });
});

describe('toPayload', () => {
  it('trims every field', () => {
    expect(toPayload({ ...toInput(saved), street: '  Dizengoff ', apartment: '  ' })).toMatchObject({
      street: 'Dizengoff',
      apartment: '',
    });
  });
});
