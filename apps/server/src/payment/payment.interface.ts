export interface PaymentResult {
  success: boolean;
  transactionId: string;
  error?: string;
  /**
   * Stable, machine-readable decline reason (e.g. "card_declined",
   * "insufficient_funds") the storefront can translate. Real providers map
   * their own codes onto these.
   */
  errorCode?: PaymentDeclineCode;
}

/** How the shopper paid. Stored on the order as `paymentMethod`. */
export const PAYMENT_METHODS = ['card', 'bit', 'apple_pay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Card brands we display; anything else is rejected by the DTO. */
export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'isracard', 'diners'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

/**
 * Outcome the mock provider should produce (test cards on the mock hosted
 * payment page). Only honoured while a test-mode provider is bound outside
 * production; see PaymentService.simulationEnabled().
 */
export const PAYMENT_SIMULATIONS = ['success', 'decline', 'insufficient_funds', '3ds'] as const;
export type PaymentSimulation = (typeof PAYMENT_SIMULATIONS)[number];

export type PaymentDeclineCode = 'card_declined' | 'insufficient_funds' | 'provider_error' | 'declined';

export interface PaymentChargeParams {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail: string;
  idempotencyKey: string;
  cardToken?: string;
  method?: PaymentMethod;
  installments?: number;
  /** Test-mode providers only; never forwarded when simulation is disabled. */
  simulation?: PaymentSimulation;
}

export interface PaymentProvider {
  /** Stable identifier recorded on every PaymentAttempt (e.g. "mock"). */
  readonly name: string;

  /**
   * True for providers that move no money (the mock). Enables the storefront's
   * test banner and test cards, and the `simulation` parameter.
   */
  readonly testMode?: boolean;

  /**
   * Charge the customer. `amount` always comes from the server-side order
   * total, never from the client. `idempotencyKey` is the PaymentAttempt id:
   * real providers must forward it so a retried HTTP call cannot double-charge.
   * Raw card data never reaches this server: a real hosted-page / tokenised
   * integration passes an opaque `cardToken`.
   */
  charge(params: PaymentChargeParams): Promise<PaymentResult>;

  refund(transactionId: string, amount?: number): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
