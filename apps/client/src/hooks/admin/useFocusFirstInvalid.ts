'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Returns a function that moves focus to the first `aria-invalid` field in
 * the container once the errors it just set have rendered.
 */
export function useFocusFirstInvalid(containerRef: RefObject<HTMLElement | null>) {
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (request === 0) return;
    containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [request, containerRef]);

  return useCallback(() => setRequest((n) => n + 1), []);
}
