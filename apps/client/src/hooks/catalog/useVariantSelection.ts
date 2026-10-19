'use client';

import { useReducer } from 'react';
import {
  initialSelection,
  resolveSelection,
  selectionReducer,
  type ResolvedSelection,
} from '@/lib/catalog/variant-selection';
import type { Variant } from '@/lib/catalog/types';
import type { ErrorMessage } from '@/lib/shop-errors';

export type VariantSelectionApi = ResolvedSelection & {
  selectColor: (color: string) => void;
  selectSize: (size: string) => void;
  increment: () => void;
  decrement: () => void;
  /** Show (or with null, clear) an add-to-bag error for the current variant. */
  setAddError: (error: ErrorMessage | null) => void;
};

/**
 * Colour / size / quantity picked on the product page (and the add-to-bag error
 * for that pick, cleared when another variant is picked). The selection is
 * re-validated against `variants` on every render, so a live stock refresh
 * never leaves a missing or sold-out size selected.
 */
export function useVariantSelection(variants: Variant[]): VariantSelectionApi {
  const [state, dispatch] = useReducer(selectionReducer, variants, initialSelection);
  return {
    ...resolveSelection(state, variants),
    selectColor: (color) => dispatch({ type: 'selectColor', color, variants }),
    selectSize: (size) => dispatch({ type: 'selectSize', size, variants }),
    increment: () => dispatch({ type: 'changeQuantity', delta: 1, variants }),
    decrement: () => dispatch({ type: 'changeQuantity', delta: -1, variants }),
    setAddError: (error) => dispatch({ type: 'setAddError', error }),
  };
}
