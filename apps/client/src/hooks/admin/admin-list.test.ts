import { describe, expect, it } from 'vitest';
import { adminListReducer, initialAdminList } from './admin-list';

type Row = { id: string; status: string };

describe('adminListReducer', () => {
  const page = { items: [{ id: 'a', status: 'NEW' }], total: 1, totalPages: 0, meta: { newCount: 1 } };
  const loaded = adminListReducer(initialAdminList<Row, { newCount: number }>(), { type: 'success', page });

  it('starts loading with no rows', () => {
    expect(initialAdminList()).toMatchObject({ items: [], loading: true, loaded: false, error: false });
  });

  it('stores a page and clamps the page count to at least 1', () => {
    expect(loaded).toMatchObject({ items: page.items, total: 1, totalPages: 1, meta: { newCount: 1 }, loading: false, loaded: true });
  });

  it('keeps the previous rows when a load fails', () => {
    const failed = adminListReducer({ ...loaded, loading: true }, { type: 'failure' });
    expect(failed).toMatchObject({ items: page.items, loading: false, error: true });
    expect(adminListReducer(failed, { type: 'dismissError' }).error).toBe(false);
  });

  it('bumps the version to reload', () => {
    expect(adminListReducer(loaded, { type: 'reload' }).version).toBe(loaded.version + 1);
  });

  it('patches rows and meta in place', () => {
    const patched = adminListReducer(loaded, {
      type: 'patch',
      items: (rows) => rows.map((r) => ({ ...r, status: 'HANDLED' })),
      meta: (m) => ({ newCount: m.newCount - 1 }),
    });
    expect(patched.items[0].status).toBe('HANDLED');
    expect(patched.meta).toEqual({ newCount: 0 });
  });
});
