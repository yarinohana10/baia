'use client';

import { useId, useReducer, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { simulationForCard, type PaymentConfig, type PayRequest } from '@/lib/payment';
import {
  CARD_FIELDS,
  cardErrors,
  cardFormReducer,
  cardRequest,
  futureExpiry,
  initialCardForm,
  type CardField,
} from './cardFormState';

/**
 * Card form state: number, expiry, CVV and ID are validated here and never
 * sent anywhere: `onPay` receives only the brand, last 4 digits and installments.
 * The 3-D Secure test card first shows the issuer challenge.
 */
export function useCardForm({
  total,
  config,
  busy,
  onPay,
}: {
  total: number;
  config: PaymentConfig;
  busy: boolean;
  onPay: (body: PayRequest) => void;
}) {
  const t = useTranslations('payment');
  const uid = useId();
  const [state, dispatch] = useReducer(cardFormReducer, initialCardForm);
  const errors = cardErrors(state.values);
  const inputId = (field: CardField | 'installments') => `${uid}-${field === 'holderId' ? 'holder-id' : field}`;

  /** The field's translated error once it was left or the form submitted. */
  const shown = (field: CardField) => {
    const err = errors[field];
    return err && (state.touched[field] || state.submitted) ? t(`errors.${err.key}`, err.values) : null;
  };

  /** id / value / handlers / aria wiring for one card input. */
  const inputProps = (field: CardField, hasHint = false) => {
    const error = shown(field);
    let describedBy: string | undefined;
    if (error) describedBy = `${inputId(field)}-error`;
    else if (hasHint) describedBy = `${inputId(field)}-hint`;
    return {
      id: inputId(field),
      value: state.values[field],
      onChange: (e: { target: { value: string } }) => dispatch({ type: 'input', field, value: e.target.value }),
      onBlur: () => dispatch({ type: 'blur', field }),
      disabled: busy,
      'aria-invalid': !!error,
      'aria-describedby': describedBy,
    };
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    dispatch({ type: 'submitted' });
    const firstInvalid = CARD_FIELDS.find((f) => errors[f]);
    if (firstInvalid) {
      document.getElementById(inputId(firstInvalid))?.focus();
      return;
    }
    if (config.testMode && simulationForCard(state.values.number) === '3ds') {
      dispatch({ type: 'challenge', open: true });
      return;
    }
    onPay(cardRequest(state, total, config));
  };

  return {
    state,
    dispatch,
    inputId,
    shown,
    inputProps,
    submit,
    hasErrors: CARD_FIELDS.some((f) => errors[f]),
    fillTestCard: (number: string) => dispatch({ type: 'fillTestCard', number, expiry: futureExpiry() }),
    /** 3-D Secure passed: pay with the challenge outcome. */
    verified: () => onPay(cardRequest(state, total, config, '3ds')),
  };
}
