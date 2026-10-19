import {
  cardNumberValid,
  cardPayRequest,
  cvvLength,
  detectCardBrand,
  digitsOnly,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  installmentOptions,
  israeliIdValid,
  type PaymentConfig,
  type PayRequest,
  type PaymentSimulation,
} from '@/lib/payment';

export type CardField = 'number' | 'expiry' | 'cvv' | 'holderId';
/** In on-screen order (the first invalid one gets focus). */
export const CARD_FIELDS: CardField[] = ['number', 'expiry', 'cvv', 'holderId'];
/** A key under `payment.errors` plus its values. */
export type CardFieldError = { key: string; values?: Record<string, string | number> } | null;

export type CardFormState = {
  values: Record<CardField, string>;
  installments: number;
  touched: Record<CardField, boolean>;
  submitted: boolean;
  /** Showing the 3-D Secure challenge instead of the form. */
  challenge: boolean;
};

export type CardFormAction =
  | { type: 'input'; field: CardField; value: string }
  | { type: 'blur'; field: CardField }
  | { type: 'installments'; count: number }
  /** Test mode: a test card number, keeping whatever else was typed. */
  | { type: 'fillTestCard'; number: string; expiry: string }
  | { type: 'submitted' }
  | { type: 'challenge'; open: boolean };

export const initialCardForm: CardFormState = {
  values: { number: '', expiry: '', cvv: '', holderId: '' },
  installments: 1,
  touched: { number: false, expiry: false, cvv: false, holderId: false },
  submitted: false,
  challenge: false,
};

/** Test cards fill in this ID (valid check digit) when none was typed. */
const TEST_HOLDER_ID = '000000018';

/** CVV length for the brand of the number typed so far. */
export function cardCvvLength(number: string): number {
  return cvvLength(detectCardBrand(number));
}

/** Formats / trims what was typed into a field. */
function normalize(field: CardField, value: string, number: string): string {
  if (field === 'number') return formatCardNumber(value);
  if (field === 'expiry') return formatExpiry(value);
  if (field === 'cvv') return digitsOnly(value).slice(0, cardCvvLength(number));
  return digitsOnly(value).slice(0, 9);
}

export function cardFormReducer(state: CardFormState, action: CardFormAction): CardFormState {
  switch (action.type) {
    case 'input':
      return {
        ...state,
        values: { ...state.values, [action.field]: normalize(action.field, action.value, state.values.number) },
      };
    case 'blur':
      return { ...state, touched: { ...state.touched, [action.field]: true } };
    case 'installments':
      return { ...state, installments: action.count };
    case 'fillTestCard': {
      const { values } = state;
      return {
        ...state,
        values: {
          number: formatCardNumber(action.number),
          expiry: values.expiry || action.expiry,
          cvv: values.cvv || '123',
          holderId: values.holderId || TEST_HOLDER_ID,
        },
      };
    }
    case 'submitted':
      return { ...state, submitted: true };
    case 'challenge':
      return { ...state, challenge: action.open };
  }
}

/** Every field's validation error (null when valid). */
export function cardErrors(values: CardFormState['values']): Record<CardField, CardFieldError> {
  const { number, expiry, cvv, holderId } = values;
  const cvvLen = cardCvvLength(number);
  let numberError: CardFieldError = null;
  if (!digitsOnly(number)) numberError = { key: 'numberRequired' };
  else if (!cardNumberValid(number)) numberError = { key: 'numberInvalid' };
  let expiryError: CardFieldError = null;
  if (!expiry) expiryError = { key: 'expiryRequired' };
  else if (!expiryValid(expiry)) expiryError = { key: 'expiryInvalid' };
  let idError: CardFieldError = null;
  if (!holderId) idError = { key: 'idRequired' };
  else if (!israeliIdValid(holderId)) idError = { key: 'idInvalid' };
  return {
    number: numberError,
    expiry: expiryError,
    cvv: new RegExp(`^\\d{${cvvLen}}$`).test(cvv) ? null : { key: 'cvvInvalid', values: { length: cvvLen } },
    holderId: idError,
  };
}

/** "12/28": two years ahead, for the test-card filler. */
export function futureExpiry(now = new Date()): string {
  return `12/${String((now.getFullYear() + 2) % 100).padStart(2, '0')}`;
}

/** What is sent for this card (never the number itself), with a valid installments count. */
export function cardRequest(
  state: CardFormState,
  total: number,
  config: PaymentConfig,
  simulation?: PaymentSimulation,
): PayRequest {
  const options = installmentOptions(total, config.installments);
  const installments = options.includes(state.installments) ? state.installments : 1;
  const opts = simulation ? { testMode: true, simulation } : { testMode: config.testMode };
  return cardPayRequest(state.values.number, installments, opts);
}
