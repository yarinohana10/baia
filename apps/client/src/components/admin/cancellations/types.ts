export type RequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'AUTO_CANCELLED';

export type AdminCancellation = {
  id: string;
  status: RequestStatus;
  reason: string;
  details: string | null;
  contactPhone: string | null;
  adminNote: string | null;
  feeAmount: string;
  refundAmount: string | null;
  createdAt: string;
  resolvedAt: string | null;
  requiresReturn: boolean;
  /** Always the capped fee: 5% of the total or ₪100, whichever is lower. */
  suggestedFee: number;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customerEmail: string;
    recipientName: string | null;
    phone: string | null;
    total: string;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    paid: boolean;
    hasPaymentRef: boolean;
  };
};

export type ResolveAction = 'approve' | 'reject';

/** Whole hours since `fromIso`, shown as hours below two days and as days after. */
export function elapsedSince(fromIso: string): { unit: 'hours' | 'days'; count: number } {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 3_600_000));
  return hours < 48 ? { unit: 'hours', count: hours } : { unit: 'days', count: Math.floor(hours / 24) };
}

/** Fee typed by the admin: a number between 0 and the order total. */
export function parseFee(fee: string, total: number): number | null {
  const value = Number(fee);
  return fee.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= total ? value : null;
}
