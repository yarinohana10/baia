'use client';

import { useReducer } from 'react';
import { LIGHTBOX_CLOSED, lightboxReducer } from '@/lib/catalog/lightbox';

/** Full-screen gallery viewer state: open/closed, current image and zoom. */
export function useLightbox() {
  const [state, dispatch] = useReducer(lightboxReducer, LIGHTBOX_CLOSED);
  return {
    ...state,
    openAt: (index: number) => dispatch({ type: 'open', index }),
    close: () => dispatch({ type: 'close' }),
    show: (index: number) => dispatch({ type: 'show', index }),
    step: (delta: number, count: number) => dispatch({ type: 'step', delta, count }),
    toggleZoom: () => dispatch({ type: 'toggleZoom' }),
  };
}

export type LightboxController = ReturnType<typeof useLightbox>;
