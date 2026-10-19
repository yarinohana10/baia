export type LightboxState = { isOpen: boolean; index: number; zoomed: boolean };

export type LightboxAction =
  | { type: 'open'; index: number }
  | { type: 'close' }
  | { type: 'show'; index: number }
  | { type: 'step'; delta: number; count: number }
  | { type: 'toggleZoom' };

/** Lightbox transitions; moving to another image always zooms back out. */
export function lightboxReducer(state: LightboxState, action: LightboxAction): LightboxState {
  switch (action.type) {
    case 'open':
      return { isOpen: true, index: action.index, zoomed: false };
    case 'close':
      // Keep the index so the closing animation still shows the same image.
      return { ...state, isOpen: false };
    case 'show':
      return { ...state, index: action.index, zoomed: false };
    case 'step':
      return { ...state, index: (state.index + action.delta + action.count) % action.count, zoomed: false };
    case 'toggleZoom':
      return { ...state, zoomed: !state.zoomed };
  }
}

export const LIGHTBOX_CLOSED: LightboxState = { isOpen: false, index: 0, zoomed: false };
