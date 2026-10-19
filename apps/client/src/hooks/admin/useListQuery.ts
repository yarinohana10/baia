'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { initialListQuery, listQueryReducer, type ListQuery } from './list-query';

const SEARCH_DELAY_MS = 300;

export type ListQueryControls<F> = {
  setSearch: (value: string) => void;
  setFilter: (value: F) => void;
  setPage: (page: number) => void;
  restore: (query: { search?: string; filter?: F; page?: number }) => void;
};

/** Search box, filter and page of an admin list; the search applies 300ms after typing stops. */
export function useListQuery<F>(initialFilter: F): [ListQuery<F>, ListQueryControls<F>] {
  const [query, dispatch] = useReducer(listQueryReducer<F>, initialFilter, initialListQuery);

  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: 'applySearch' }), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [query.search]);

  const controls = useMemo<ListQueryControls<F>>(
    () => ({
      setSearch: (value) => dispatch({ type: 'search', value }),
      setFilter: (value) => dispatch({ type: 'filter', value }),
      setPage: (page) => dispatch({ type: 'page', page }),
      restore: (restored) => dispatch({ type: 'restore', ...restored }),
    }),
    [],
  );

  return [query, controls];
}
