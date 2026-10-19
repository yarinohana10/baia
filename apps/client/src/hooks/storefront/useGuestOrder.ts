'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { CustomerOrder } from '@/lib/orders';
import { releaseOrderToken, takeOrderToken } from '@/lib/order-token';

type GuestOrderState = {
  order: CustomerOrder | null;
  notFound: boolean;
  /** The guest token from the URL fragment, kept in memory for this page view only. */
  guestToken: string | null;
};

const LOADING: GuestOrderState = { order: null, notFound: false, guestToken: null };

const orderPath = (id: string) => `/orders/${encodeURIComponent(id)}`;

/**
 * Loads an order the viewer may see. This has to happen in the browser:
 * guests arrive with `#token=...` (a URL fragment never reaches the server),
 * which is exchanged once for an httpOnly cookie scoped to this order, so a
 * refresh keeps working without the token ever sitting in the URL or in JS
 * storage. Signed-in owners (and cookie holders) are served by GET /orders/:id.
 *
 * `onLoaded` runs whenever an order arrives (first load and `refresh()`), e.g.
 * to move on from a page that no longer applies to it.
 */
export function useGuestOrder(id: string, onLoaded?: (order: CustomerOrder, guestToken: string | null) => void) {
  const [state, setState] = useState<GuestOrderState>(LOADING);
  // The latest callback, read when a response arrives (so it never restarts the load).
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    let cancelled = false;
    const token = takeOrderToken(id);
    const request = token
      ? api.post<CustomerOrder>(`${orderPath(id)}/access`, { token }).finally(() => releaseOrderToken(id))
      : api.get<CustomerOrder>(orderPath(id));
    request.then(
      (res) => {
        if (cancelled) return;
        setState({ order: res.data, notFound: false, guestToken: token });
        onLoadedRef.current?.(res.data, token);
      },
      () => {
        if (!cancelled) setState({ order: null, notFound: true, guestToken: token });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Replace the order with a fresher copy (e.g. the server's answer to a cancellation). */
  const setOrder = useCallback((order: CustomerOrder) => setState((s) => ({ ...s, order })), []);

  /** Re-read the order (best effort). */
  const refresh = () => {
    api
      .get<CustomerOrder>(orderPath(id))
      .then((res) => {
        setOrder(res.data);
        onLoadedRef.current?.(res.data, state.guestToken);
      })
      .catch(() => undefined);
  };

  return { ...state, setOrder, refresh };
}
