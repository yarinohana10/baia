'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { api } from '@/lib/api';
import { adminListReducer, initialAdminList, type AdminListState, type ListPage } from './admin-list';

export type ListParams = Record<string, string | number | boolean | undefined>;

type Options<R, T, M> = {
  url: string;
  params?: ListParams;
  /** Maps the response body to a page. Must be stable (declare it at module scope). */
  select: (data: R) => ListPage<T, M>;
  /** False holds the request back (e.g. until the query is restored from the URL). */
  enabled?: boolean;
};

export type AdminList<T, M = undefined> = AdminListState<T, M> & {
  reload: () => void;
  dismissError: () => void;
  patch: (update: { items?: (items: T[]) => T[]; meta?: (meta: M) => M }) => void;
};

/**
 * Loads an admin list page whenever the URL or params change. Responses that
 * arrive after a newer request started are ignored.
 */
export function useAdminList<R, T, M = undefined>({
  url,
  params,
  select,
  enabled = true,
}: Options<R, T, M>): AdminList<T, M> {
  const [state, dispatch] = useReducer(adminListReducer<T, M>, undefined, initialAdminList<T, M>);
  // Params are compared by value, so callers can pass a fresh object every render.
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    dispatch({ type: 'request' });
    api.get<R>(url, { params: JSON.parse(paramsKey) as ListParams }).then(
      (res) => {
        if (!cancelled) dispatch({ type: 'success', page: select(res.data) });
      },
      () => {
        if (!cancelled) dispatch({ type: 'failure' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, paramsKey, select, enabled, state.version]);

  const controls = useMemo(
    () => ({
      reload: () => dispatch({ type: 'reload' }),
      dismissError: () => dispatch({ type: 'dismissError' }),
      patch: (update: { items?: (items: T[]) => T[]; meta?: (meta: M) => M }) =>
        dispatch({ type: 'patch', ...update }),
    }),
    [],
  );

  return { ...state, ...controls };
}
