import { create } from 'zustand';
import { api } from '@/lib/api';
import { availableQty, isSaleActive, isUnlimited } from '@/lib/catalog/pricing';
import { shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { currentLocale } from '@/lib/auth-client';

export type CartItem = {
  id: string;
  quantity: number;
  variant: {
    id: string;
    color: string;
    size: string;
    sku: string;
    stockQuantity: number;
    /** false = unlimited stock (stockQuantity is ignored). */
    trackInventory?: boolean;
    isActive?: boolean;
    priceOverride: string | null;
    salePrice: string | null;
    saleStart: string | null;
    saleEnd: string | null;
    product: {
      id: string;
      nameHe: string;
      nameEn: string;
      slug: string;
      basePrice: string;
      isActive?: boolean;
      images: { url: string }[];
    };
  };
};

/** Why a cart line cannot be checked out as-is, or null when it is fine. */
export type LineIssue =
  | { kind: 'unavailable' }
  | { kind: 'outOfStock' }
  | { kind: 'insufficient'; available: number };

export function lineIssue(item: CartItem): LineIssue | null {
  const v = item.variant;
  if (v.isActive === false || v.product.isActive === false) return { kind: 'unavailable' };
  if (isUnlimited(v)) return null;
  if (v.stockQuantity <= 0) return { kind: 'outOfStock' };
  if (v.stockQuantity < item.quantity) return { kind: 'insufficient', available: v.stockQuantity };
  return null;
}

/** The quantity a "decrease" step should move to (straight down to stock when over it). */
export function decreasedQuantity(item: CartItem): number {
  const issue = lineIssue(item);
  if (issue?.kind === 'insufficient') return issue.available;
  if (issue) return 0;
  return item.quantity - 1;
}

export function canIncrease(item: CartItem): boolean {
  return !lineIssue(item) && item.quantity < availableQty(item.variant);
}

export function unitPrice(item: CartItem): { price: number; original: number | null } {
  const base = parseFloat(item.variant.priceOverride || item.variant.product.basePrice);
  if (isSaleActive(item.variant)) return { price: parseFloat(item.variant.salePrice!), original: base };
  return { price: base, original: null };
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + unitPrice(item).price * item.quantity, 0);
}

export type ShippingConfig = { cost: number; freeThreshold: number };

/** Same fallbacks the API uses when no site config row exists. */
const DEFAULT_SHIPPING: ShippingConfig = { cost: 29.9, freeThreshold: 249 };

export function shippingFor(subtotal: number, config: ShippingConfig): number {
  return subtotal >= config.freeThreshold ? 0 : config.cost;
}

type CartStore = {
  items: CartItem[];
  /** True until the first fetch settles, and while re-fetching. */
  loading: boolean;
  loaded: boolean;
  drawerOpen: boolean;
  shipping: ShippingConfig;
  /** Line ids with an update/remove in flight. */
  pending: Record<string, boolean>;
  /** Last failed update/remove per line, as a `checkout.errors` key. */
  lineErrors: Record<string, ErrorMessage>;
  openDrawer: () => void;
  closeDrawer: () => void;
  fetchCart: () => Promise<void>;
  fetchShipping: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  itemCount: () => number;
};

// Guest carts are identified by an httpOnly cookie the API sets on the first
// add (sent automatically via withCredentials) — no id is kept in JS.

let shippingRequest: Promise<void> | null = null;

export const useCartStore = create<CartStore>((set, get) => {
  /** Runs a line mutation with a pending flag; on failure records a translated error and re-syncs. */
  async function mutateLine(itemId: string, request: () => Promise<{ data: { items?: CartItem[] } }>) {
    if (get().pending[itemId]) return;
    set((s) => {
      const lineErrors = { ...s.lineErrors };
      delete lineErrors[itemId];
      return { pending: { ...s.pending, [itemId]: true }, lineErrors };
    });
    try {
      const res = await request();
      set({ items: res.data.items || [] });
    } catch (err) {
      set((s) => ({ lineErrors: { ...s.lineErrors, [itemId]: shopErrorMessage(err, currentLocale()) } }));
      // The cart may have changed underneath us (stock, removed line): show the truth.
      await get().fetchCart();
    } finally {
      set((s) => {
        const pending = { ...s.pending };
        delete pending[itemId];
        return { pending };
      });
    }
  }

  return {
    items: [],
    loading: true,
    loaded: false,
    drawerOpen: false,
    shipping: DEFAULT_SHIPPING,
    pending: {},
    lineErrors: {},
    openDrawer: () => set({ drawerOpen: true }),
    closeDrawer: () => set({ drawerOpen: false }),

    fetchCart: async () => {
      set({ loading: true });
      try {
        const res = await api.get('/cart');
        set({ items: res.data.items || [] });
      } catch {
        set({ items: [] });
      } finally {
        set({ loading: false, loaded: true });
      }
    },

    // Shipping cost and free-shipping threshold come from the admin's site config.
    fetchShipping: () => {
      shippingRequest ??= api
        .get('/site-config')
        .then((res) => {
          const cost = parseFloat(res.data?.shippingCost);
          const freeThreshold = parseFloat(res.data?.freeShippingThreshold);
          set({
            shipping: {
              cost: Number.isFinite(cost) ? cost : DEFAULT_SHIPPING.cost,
              freeThreshold: Number.isFinite(freeThreshold) ? freeThreshold : DEFAULT_SHIPPING.freeThreshold,
            },
          });
        })
        .catch(() => {
          shippingRequest = null; // retry on the next mount
        });
      return shippingRequest;
    },

    addItem: async (variantId, quantity) => {
      const res = await api.post('/cart/items', { variantId, quantity });
      set({ items: res.data.items || [] });
    },

    updateQuantity: (itemId, quantity) =>
      mutateLine(itemId, () => api.put(`/cart/items/${itemId}`, { quantity })),

    removeItem: (itemId) => mutateLine(itemId, () => api.delete(`/cart/items/${itemId}`)),

    // After sign-in: moves the guest cart (from the cookie) into the account,
    // server-side, respecting stock. A no-op when there is no guest cart.
    mergeGuestCart: async () => {
      const res = await api.post('/cart/merge');
      set({ items: res.data.cart?.items || [] });
    },

    itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  };
});
