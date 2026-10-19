'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react';

const FOCUSABLE = 'button, select, textarea, input, a[href]';

/**
 * A native `<dialog>` opened as a modal while mounted: the rest of the page is
 * inert, focus starts on the first control, Tab wraps inside, Escape and a
 * click on the backdrop call `onClose`, and focus returns to the opener.
 * Spread the returned props on a full-screen `<dialog>` that wraps the panel.
 */
export function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  // Before paint, so the dialog is never shown non-modal.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);

  return {
    ref,
    /** Escape: let React unmount the dialog instead of the browser closing it. */
    onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    /** Keep Tab inside the dialog (the browser would move on to its own UI). */
    onKeyDown: (e: KeyboardEvent<HTMLDialogElement>) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    /** The dialog itself is the dimmed backdrop around the panel. */
    onMouseDown: (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
  };
}
