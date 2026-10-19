import type { FieldIssues } from '@baia/shared';
import type { ErrorMessage } from '@/lib/shop-errors';
import type { CancellationInfo, CancellationReason, CustomerOrder } from '@/lib/orders';
import { clearIssue } from '@/lib/form-errors';

/** POST /orders/lookup: the order plus a signed access token. */
export type FoundOrder = { order: CustomerOrder; accessToken: string };
/** POST /cancellations. */
export type CancellationResult = { outcome: 'CANCELLED' | 'REQUESTED'; order: CustomerOrder; accessToken: string };

export type CancelOrderFields = {
  orderNumber: string;
  email: string;
  phone: string;
  reason: CancellationReason | '';
  details: string;
};

export type CancelOrderFormState = {
  fields: CancelOrderFields;
  /** Validation issues, keyed by schema field. */
  issues: FieldIssues;
  /** Step 2: the order was found and may be cancelled instantly. */
  found: FoundOrder | null;
  /** Step 2 choice: cancel now (default) or ask the store to call first. */
  instant: boolean;
  error: ErrorMessage | null;
  result: CancellationResult | null;
};

/** One field edit, typed per field. */
export type CancelOrderEdit = {
  [K in keyof CancelOrderFields]: { type: 'edit'; field: K; value: CancelOrderFields[K] };
}[keyof CancelOrderFields];

export type CancelOrderFormAction =
  | CancelOrderEdit
  | { type: 'validated'; issues: FieldIssues }
  | { type: 'submitting' }
  | { type: 'found'; found: FoundOrder }
  | { type: 'failed'; error: ErrorMessage }
  | { type: 'chooseInstant'; instant: boolean }
  | { type: 'startOver' }
  | { type: 'completed'; result: CancellationResult };

export const initialCancelOrderForm: CancelOrderFormState = {
  fields: { orderNumber: '', email: '', phone: '', reason: '', details: '' },
  issues: {},
  found: null,
  instant: true,
  error: null,
  result: null,
};

/** Form field → `publicCancellationSchema` field (for clearing its issue on edit). */
const SCHEMA_FIELD: Record<keyof CancelOrderFields, string> = {
  orderNumber: 'orderNumber',
  email: 'email',
  phone: 'contactPhone',
  reason: 'reason',
  details: 'details',
};

export function cancelOrderFormReducer(state: CancelOrderFormState, action: CancelOrderFormAction): CancelOrderFormState {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
        issues: clearIssue(state.issues, SCHEMA_FIELD[action.field]),
      };
    case 'validated':
      return { ...state, issues: action.issues };
    case 'submitting':
      return { ...state, error: null };
    case 'found':
      return { ...state, found: action.found };
    case 'failed':
      return { ...state, error: action.error };
    case 'chooseInstant':
      return { ...state, instant: action.instant };
    case 'startOver':
      return { ...state, found: null, error: null };
    case 'completed':
      return { ...state, result: action.result };
  }
}

/** Whether step 2 will cancel right away (rather than file a request). */
export function cancelsInstantly(state: Pick<CancelOrderFormState, 'found' | 'instant'>): boolean {
  const info = state.found?.order.cancellation;
  return info?.canSelfCancel === true && (state.instant || !info.canRequest);
}

/** What step 1 does with the order it found. */
export type LookupNext = 'choose' | 'alreadyRequested' | 'notAllowed' | 'request';

export function nextAfterLookup(info: CancellationInfo | undefined): LookupNext {
  // Inside the free window: let the shopper choose (or confirm) before anything happens.
  if (info?.canSelfCancel) return 'choose';
  if (info?.openRequest) return 'alreadyRequested';
  if (!info?.canRequest) return 'notAllowed';
  return 'request';
}
