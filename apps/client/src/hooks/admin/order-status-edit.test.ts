import { describe, expect, it } from 'vitest';
import { draftFromOrder, draftKey, isStatusChanging, isUpdateUnchanged } from './order-status-edit';

const order = { id: 'o1', status: 'CONFIRMED', trackingNumber: null };

describe('order status draft', () => {
  it('starts from the order', () => {
    expect(draftFromOrder(order)).toEqual({ status: 'CONFIRMED', trackingNumber: '' });
    expect(draftFromOrder({ ...order, trackingNumber: 'IL1' })).toEqual({ status: 'CONFIRMED', trackingNumber: 'IL1' });
  });

  it('is changing only when another status is picked', () => {
    expect(isStatusChanging(order, { status: 'CONFIRMED', trackingNumber: '' })).toBe(false);
    expect(isStatusChanging(order, { status: 'PROCESSING', trackingNumber: '' })).toBe(true);
  });

  it('is unchanged with the same status and tracking number (ignoring spaces)', () => {
    expect(isUpdateUnchanged(order, { status: 'CONFIRMED', trackingNumber: '  ' })).toBe(true);
    expect(isUpdateUnchanged(order, { status: 'CONFIRMED', trackingNumber: 'IL1' })).toBe(false);
    expect(isUpdateUnchanged({ ...order, trackingNumber: 'IL1' }, { status: 'CONFIRMED', trackingNumber: ' IL1 ' })).toBe(true);
    expect(isUpdateUnchanged(order, { status: 'SHIPPED', trackingNumber: '' })).toBe(false);
  });

  it('gets a new key whenever the saved order changes', () => {
    expect(draftKey(order)).not.toBe(draftKey({ ...order, status: 'SHIPPED' }));
    expect(draftKey(order)).not.toBe(draftKey({ ...order, trackingNumber: 'IL1' }));
    expect(draftKey(order)).toBe(draftKey({ ...order }));
  });
});
