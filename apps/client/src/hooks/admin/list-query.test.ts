import { describe, expect, it } from 'vitest';
import { initialListQuery, listQueryReducer } from './list-query';

describe('listQueryReducer', () => {
  const start = { ...initialListQuery<string>(''), page: 3 };

  it('keeps the page while typing and resets it once a new term applies', () => {
    const typed = listQueryReducer(start, { type: 'search', value: '  bikini ' });
    expect(typed).toMatchObject({ search: '  bikini ', appliedSearch: '', page: 3 });
    expect(listQueryReducer(typed, { type: 'applySearch' })).toMatchObject({ appliedSearch: 'bikini', page: 1 });
  });

  it('ignores an apply that does not change the term', () => {
    const state = { ...start, search: 'x ', appliedSearch: 'x' };
    expect(listQueryReducer(state, { type: 'applySearch' })).toBe(state);
  });

  it('starts a new filter from the first page', () => {
    expect(listQueryReducer(start, { type: 'filter', value: 'NEW' })).toMatchObject({ filter: 'NEW', page: 1 });
  });

  it('never goes below page 1', () => {
    expect(listQueryReducer(start, { type: 'page', page: 0 }).page).toBe(1);
  });

  it('restores a query from the URL with the search already applied', () => {
    expect(listQueryReducer(start, { type: 'restore', search: 'dana ', page: 2 })).toEqual({
      search: 'dana ',
      appliedSearch: 'dana',
      filter: '',
      page: 2,
      restored: true,
    });
  });
});
