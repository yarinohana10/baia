export interface PaymentResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface PaymentProvider {
  charge(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
    cardToken?: string;
  }): Promise<PaymentResult>;

  refund(transactionId: string, amount?: number): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
