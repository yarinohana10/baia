/**
 * Search + filter + page state shared by the admin list pages. The typed
 * search is applied after a pause (`applySearch`); applying a new term or
 * picking another filter starts again from the first page.
 */
export type ListQuery<F> = {
  /** What is in the search box. */
  search: string;
  /** The trimmed term the list is fetched with. */
  appliedSearch: string;
  filter: F;
  page: number;
  /** True once the query was restored from the URL (pages that restore one). */
  restored: boolean;
};

export type ListQueryAction<F> =
  | { type: 'search'; value: string }
  | { type: 'applySearch' }
  | { type: 'filter'; value: F }
  | { type: 'page'; page: number }
  | { type: 'restore'; search?: string; filter?: F; page?: number };

export function initialListQuery<F>(filter: F): ListQuery<F> {
  return { search: '', appliedSearch: '', filter, page: 1, restored: false };
}

export function listQueryReducer<F>(state: ListQuery<F>, action: ListQueryAction<F>): ListQuery<F> {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.value };
    case 'applySearch': {
      const appliedSearch = state.search.trim();
      return appliedSearch === state.appliedSearch ? state : { ...state, appliedSearch, page: 1 };
    }
    case 'filter':
      return { ...state, filter: action.value, page: 1 };
    case 'page':
      return { ...state, page: Math.max(1, action.page) };
    case 'restore': {
      const search = action.search ?? state.search;
      return {
        search,
        appliedSearch: search.trim(),
        filter: action.filter ?? state.filter,
        page: action.page ?? state.page,
        restored: true,
      };
    }
  }
}
