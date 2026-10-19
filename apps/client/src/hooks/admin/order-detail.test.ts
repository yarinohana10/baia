import { describe, expect, it } from 'vitest';
import type { AdminOrder } from '@/components/admin/orders/types';
import {
  initialOrderDetail,
  isStatusChanging,
  isUpdateUnchanged,
  orderDetailReducer,
  type OrderDetailAction,
  type OrderDetailState,
} from './order-detail';

const order = {
  id: 'o1',
  orderNumber: 'BA-1001',
  customerEmail: 'a@example.com',
  status: 'CONFIRMED',
  subtotal: '100',
  shippingCost: '20',
  discountAmount: '0',
  total: '120',
  trackingNumber: null,
  shippingCity: 'Tel Aviv',
  shippingStreet: 'Dizengoff',
  shippingNumber: '1',
  createdAt: '2026-10-20T10:00:00.000Z',
  items: [],
} satisfies AdminOrder;

function run(...actions: OrderDetailAction[]): OrderDetailState {
  return actions.reduce(orderDetailReducer, initialOrderDetail);
}

describe('orderDetailReducer', () => {
  it('starts closed, refunding by default', () => {
    expect(initialOrderDetail).toEqual({
      order: null,
      newStatus: '',
      trackingNumber: '',
      refundOnCancel: true,
      updating: false,
      error: null,
    });
  });

  it('opening an order seeds the form from it and clears the error', () => {
    const state = run(
      { type: 'updateFailed', error: 'boom' },
      { type: 'refundChanged', refund: false },
      { type: 'opened', order: { ...order, trackingNumber: 'IL1' } },
    );
    expect(state).toMatchObject({ newStatus: 'CONFIRMED', trackingNumber: 'IL1', refundOnCancel: true, error: null });
    expect(state.order?.id).toBe('o1');
  });

  it('a missing tracking number becomes an empty field', () => {
    expect(run({ type: 'opened', order }).trackingNumber).toBe('');
  });

  it('edits the status, tracking number and refund choice', () => {
    const state = run(
      { type: 'opened', order },
      { type: 'statusChanged', status: 'SHIPPED' },
      { type: 'trackingChanged', trackingNumber: 'IL9' },
      { type: 'refundChanged', refund: false },
    );
    expect(state).toMatchObject({ newStatus: 'SHIPPED', trackingNumber: 'IL9', refundOnCancel: false });
  });

  it('closing hides the dialog and its error but keeps the fields', () => {
    const state = run(
      { type: 'opened', order },
      { type: 'statusChanged', status: 'SHIPPED' },
      { type: 'updateFailed', error: 'boom' },
      { type: 'closed' },
    );
    expect(state).toMatchObject({ order: null, error: null, newStatus: 'SHIPPED' });
  });

  it('an update clears the previous error and marks the dialog busy until it settles', () => {
    let state = run({ type: 'opened', order }, { type: 'updateFailed', error: 'boom' }, { type: 'updateStarted' });
    expect(state).toMatchObject({ updating: true, error: null });
    state = orderDetailReducer(state, { type: 'updateFailed', error: 'again' });
    expect(state).toMatchObject({ updating: true, error: 'again', order: { id: 'o1' } });
    expect(orderDetailReducer(state, { type: 'updateSettled' }).updating).toBe(false);
  });

  it('a successful update closes the dialog and resets the fields', () => {
    const state = run(
      { type: 'opened', order },
      { type: 'statusChanged', status: 'SHIPPED' },
      { type: 'trackingChanged', trackingNumber: 'IL9' },
      { type: 'updateStarted' },
      { type: 'updateSucceeded' },
    );
    expect(state).toMatchObject({ order: null, newStatus: '', trackingNumber: '', error: null, updating: true });
    expect(orderDetailReducer(state, { type: 'updateSettled' }).updating).toBe(false);
  });
});

describe('isStatusChanging / isUpdateUnchanged', () => {
  it('is false / false with no order open', () => {
    expect(isStatusChanging(initialOrderDetail)).toBe(false);
    expect(isUpdateUnchanged(initialOrderDetail)).toBe(false);
  });

  it('a freshly opened order is unchanged', () => {
    const state = run({ type: 'opened', order });
    expect(isStatusChanging(state)).toBe(false);
    expect(isUpdateUnchanged(state)).toBe(true);
  });

  it('a new status is a change', () => {
    const state = run({ type: 'opened', order }, { type: 'statusChanged', status: 'SHIPPED' });
    expect(isStatusChanging(state)).toBe(true);
    expect(isUpdateUnchanged(state)).toBe(false);
  });

  it('a new tracking number is a change; surrounding spaces are not', () => {
    const opened = run({ type: 'opened', order: { ...order, trackingNumber: 'IL1' } });
    expect(isUpdateUnchanged(orderDetailReducer(opened, { type: 'trackingChanged', trackingNumber: ' IL1 ' }))).toBe(true);
    expect(isUpdateUnchanged(orderDetailReducer(opened, { type: 'trackingChanged', trackingNumber: 'IL2' }))).toBe(false);
  });
});
