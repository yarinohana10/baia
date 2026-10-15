export interface PaymentResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface PaymentProvider {
  /** Stable identifier recorded on every PaymentAttempt (e.g. "mock"). */
  readonly name: string;

  /**
   * Charge the customer. `amount` always comes from the server-side order
   * total, never from the client. `idempotencyKey` is the PaymentAttempt id:
   * real providers must forward it so a retried HTTP call cannot double-charge.
   */
  charge(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
    idempotencyKey: string;
    cardToken?: string;
  }): Promise<PaymentResult>;

  refund(transactionId: string, amount?: number): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
