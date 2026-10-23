import { isAxiosError } from 'axios';

/** Body of POST /admin/orders/:id/cancel. */
export type CancelBody = { refund: boolean; feeAmount?: number; adminNote?: string };

/** Response of POST /admin/orders/:id/cancel. */
export type CancelResult = { refundAmount?: string | number | null; refundPending?: boolean };

/** Fee typed by the admin: a number between 0 and the order total, or null. Empty means no fee (0). */
export function parseCancelFee(fee: string, total: number): number | null {
  if (fee.trim() === '') return 0;
  const value = Number(fee);
  return Number.isFinite(value) && value >= 0 && value <= total ? Math.round(value * 100) / 100 : null;
}

/** The request body for cancelling: refunds only paid orders; empty fee / note are left out. */
export function buildCancelBody(input: { refund: boolean; fee: number; note: string }): CancelBody {
  const body: CancelBody = { refund: input.refund };
  if (input.refund && input.fee > 0) body.feeAmount = input.fee;
  const note = input.note.trim();
  if (note) body.adminNote = note;
  return body;
}

export type CancelOutcome = 'cancelled' | 'cancelledRefunded' | 'cancelledRefundPending';

/** Which message describes how the cancellation ended. */
export function cancelOutcome(refunded: boolean, result: CancelResult | undefined): CancelOutcome {
  if (result?.refundPending) return 'cancelledRefundPending';
  return refunded && result?.refundAmount != null ? 'cancelledRefunded' : 'cancelled';
}

/** Body of POST /admin/refunds/:id/complete; blank fields are left out. */
export function buildCompleteBody(input: { providerRef: string; note: string }): { providerRef?: string; note?: string } {
  const providerRef = input.providerRef.trim();
  const note = input.note.trim();
  return { ...(providerRef ? { providerRef } : {}), ...(note ? { note } : {}) };
}

export type ResendResult = { status: 'SENT' | 'FAILED'; attempts?: number; error?: string | null };

export type ResendOutcome = 'sent' | 'failed' | 'notReached' | 'error';

/** Outcome of a resend request, from its response or its error (409 = the order has not reached that state). */
export function resendOutcome(result: ResendResult | null, err?: unknown): ResendOutcome {
  if (result) return result.status === 'SENT' ? 'sent' : 'failed';
  return isAxiosError(err) && err.response?.status === 409 ? 'notReached' : 'error';
}
