/** One page of an admin list, normalised from the endpoint's response. */
export type ListPage<T, M = undefined> = {
  items: T[];
  total: number;
  totalPages: number;
  /** Endpoint-specific extras (e.g. the inbox's unread count). */
  meta: M;
};

export type AdminListState<T, M = undefined> = {
  items: T[];
  total: number;
  totalPages: number;
  /** Null until the first page has loaded. */
  meta: M | null;
  loading: boolean;
  /** The last load failed (the previous rows are kept). */
  error: boolean;
  /** At least one page has loaded. */
  loaded: boolean;
  /** Bumped to fetch the current page again. */
  version: number;
};

export type AdminListAction<T, M = undefined> =
  | { type: 'request' }
  | { type: 'success'; page: ListPage<T, M> }
  | { type: 'failure' }
  | { type: 'dismissError' }
  | { type: 'reload' }
  | { type: 'patch'; items?: (items: T[]) => T[]; meta?: (meta: M) => M };

export function initialAdminList<T, M = undefined>(): AdminListState<T, M> {
  return { items: [], total: 0, totalPages: 1, meta: null, loading: true, error: false, loaded: false, version: 0 };
}

export function adminListReducer<T, M = undefined>(
  state: AdminListState<T, M>,
  action: AdminListAction<T, M>,
): AdminListState<T, M> {
  switch (action.type) {
    case 'request':
      return state.loading ? state : { ...state, loading: true };
    case 'success':
      return {
        ...state,
        items: action.page.items,
        total: action.page.total,
        totalPages: Math.max(1, action.page.totalPages),
        meta: action.page.meta,
        loading: false,
        error: false,
        loaded: true,
      };
    case 'failure':
      return { ...state, loading: false, error: true };
    case 'dismissError':
      return state.error ? { ...state, error: false } : state;
    case 'reload':
      return { ...state, version: state.version + 1 };
    case 'patch':
      return {
        ...state,
        items: action.items ? action.items(state.items) : state.items,
        meta: action.meta && state.meta !== null ? action.meta(state.meta) : state.meta,
      };
  }
}
