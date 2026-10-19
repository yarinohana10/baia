import { describe, expect, it } from 'vitest';
import { cardErrors, cardFormReducer, cardRequest, futureExpiry, initialCardForm } from '../cardFormState';
import type { PaymentConfig } from '@/lib/payment';

const config: PaymentConfig = { provider: 'mock', testMode: true, methods: ['card'], installments: { max: 3, minTotal: 100 } };

describe('cardFormReducer', () => {
  it('formats what is typed', () => {
    let state = cardFormReducer(initialCardForm, { type: 'input', field: 'number', value: '4242424242424242' });
    expect(state.values.number).toBe('4242 4242 4242 4242');
    state = cardFormReducer(state, { type: 'input', field: 'cvv', value: '12a345' });
    expect(state.values.cvv).toBe('123');
    state = cardFormReducer(state, { type: 'input', field: 'holderId', value: '1234567890' });
    expect(state.values.holderId).toBe('123456789');
  });

  it('fills a test card without overwriting typed details', () => {
    const typed = cardFormReducer(initialCardForm, { type: 'input', field: 'cvv', value: '999' });
    const filled = cardFormReducer(typed, { type: 'fillTestCard', number: '4000000000000002', expiry: '12/28' });
    expect(filled.values).toEqual({ number: '4000 0000 0000 0002', expiry: '12/28', cvv: '999', holderId: '000000018' });
  });

  it('tracks touched fields, submission and the 3-D Secure challenge', () => {
    const state = cardFormReducer(cardFormReducer(initialCardForm, { type: 'blur', field: 'expiry' }), { type: 'submitted' });
    expect(state.touched.expiry).toBe(true);
    expect(state.submitted).toBe(true);
    expect(cardFormReducer(state, { type: 'challenge', open: true }).challenge).toBe(true);
  });
});

describe('cardErrors', () => {
  it('reports each missing or invalid field', () => {
    expect(cardErrors(initialCardForm.values)).toEqual({
      number: { key: 'numberRequired' },
      expiry: { key: 'expiryRequired' },
      cvv: { key: 'cvvInvalid', values: { length: 3 } },
      holderId: { key: 'idRequired' },
    });
    expect(
      cardErrors({ number: '4242 4242 4242 4242', expiry: futureExpiry(), cvv: '123', holderId: '000000018' }),
    ).toEqual({ number: null, expiry: null, cvv: null, holderId: null });
  });
});

describe('cardRequest', () => {
  const state = { ...initialCardForm, values: { ...initialCardForm.values, number: '4242 4242 4242 4242' }, installments: 3 };

  it('sends only the brand, last 4 and a valid installments count', () => {
    expect(cardRequest(state, 300, config)).toEqual({
      method: 'card',
      installments: 3,
      cardBrand: 'visa',
      cardLast4: '4242',
      simulation: 'success',
    });
    expect(cardRequest(state, 50, config).installments).toBe(1);
  });

  it('reports the 3-D Secure outcome after the challenge', () => {
    expect(cardRequest(state, 300, { ...config, testMode: false }, '3ds').simulation).toBe('3ds');
  });
});
