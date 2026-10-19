import type { AdminOrder } from '@/components/admin/orders/types';

/** The admin order dialog: the open order and its pending status update. */
export type OrderDetailState = {
  order: AdminOrder | null;
  newStatus: string;
  trackingNumber: string;
  refundOnCancel: boolean;
  updating: boolean;
  error: string | null;
};

export type OrderDetailAction =
  | { type: 'opened'; order: AdminOrder }
  | { type: 'closed' }
  | { type: 'statusChanged'; status: string }
  | { type: 'trackingChanged'; trackingNumber: string }
  | { type: 'refundChanged'; refund: boolean }
  | { type: 'updateStarted' }
  | { type: 'updateSucceeded' }
  | { type: 'updateFailed'; error: string }
  | { type: 'updateSettled' };

export const initialOrderDetail: OrderDetailState = {
  order: null,
  newStatus: '',
  trackingNumber: '',
  refundOnCancel: true,
  updating: false,
  error: null,
};

export function orderDetailReducer(state: OrderDetailState, action: OrderDetailAction): OrderDetailState {
  switch (action.type) {
    case 'opened':
      return {
        ...state,
        order: action.order,
        newStatus: action.order.status,
        trackingNumber: action.order.trackingNumber || '',
        refundOnCancel: true,
        error: null,
      };
    case 'closed':
      return { ...state, order: null, error: null };
    case 'statusChanged':
      return { ...state, newStatus: action.status };
    case 'trackingChanged':
      return { ...state, trackingNumber: action.trackingNumber };
    case 'refundChanged':
      return { ...state, refundOnCancel: action.refund };
    case 'updateStarted':
      return { ...state, updating: true, error: null };
    case 'updateSucceeded':
      return { ...state, order: null, error: null, newStatus: '', trackingNumber: '' };
    case 'updateFailed':
      return { ...state, error: action.error };
    case 'updateSettled':
      return { ...state, updating: false };
  }
}

/** True when the picked status differs from the order's current one. */
export function isStatusChanging(state: OrderDetailState): boolean {
  return !!state.order && state.newStatus !== state.order.status;
}

/** Nothing to save: same status and same tracking number. */
export function isUpdateUnchanged(state: OrderDetailState): boolean {
  return (
    !!state.order &&
    state.newStatus === state.order.status &&
    state.trackingNumber.trim() === (state.order.trackingNumber || '')
  );
}
