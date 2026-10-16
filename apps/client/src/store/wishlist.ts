import { create } from 'zustand';
import { api } from '@/lib/api';

/** Enough of a product to render a ProductCard without another request. */
export type WishlistProduct = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  images: { url: string }[];
  variants: {
    id?: string;
    salePrice?: string | null;
    saleStart?: string | null;
    saleEnd?: string | null;
    priceOverride?: string | null;
    stockQuantity?: number;
    trackInventory?: boolean;
  }[];
};

type WishlistStore = {
  /** 'guest' = localStorage only; 'user' = persisted server-side. */
  mode: 'guest' | 'user';
  products: Record<string, WishlistProduct>;
  ready: boolean;
  has: (productId: string) => boolean;
  toggle: (product: WishlistProduct) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  /** Load the guest list from localStorage. */
  loadGuest: () => void;
  /** Merge the local guest list into the account, then switch to server mode. */
  syncUser: () => Promise<void>;
};

const STORAGE_KEY = 'baia_wishlist';
const MAX_LOCAL_ITEMS = 100; // matches the server's merge limit

function readLocal(): Record<string, WishlistProduct> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocal(products: Record<string, WishlistProduct>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // Storage full or disabled: the in-memory list still works for this tab.
  }
}

function toSnapshot(p: WishlistProduct): WishlistProduct {
  return {
    id: p.id,
    nameHe: p.nameHe,
    nameEn: p.nameEn,
    slug: p.slug,
    basePrice: p.basePrice,
    images: p.images.slice(0, 1).map((i) => ({ url: i.url })),
    variants: p.variants.map((v) => ({
      salePrice: v.salePrice,
      saleStart: v.saleStart,
      saleEnd: v.saleEnd,
      priceOverride: v.priceOverride,
      stockQuantity: v.stockQuantity,
      trackInventory: v.trackInventory,
    })),
  };
}

function fromServer(rows: { product: WishlistProduct }[]): Record<string, WishlistProduct> {
  return Object.fromEntries(rows.map((r) => [r.product.id, r.product]));
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  mode: 'guest',
  products: {},
  ready: false,

  has: (productId) => productId in get().products,

  toggle: async (product) => {
    if (get().has(product.id)) return get().remove(product.id);

    const previous = get().products;
    set({ products: { ...previous, [product.id]: toSnapshot(product) } });

    if (get().mode === 'guest') {
      const local = readLocal();
      if (Object.keys(local).length >= MAX_LOCAL_ITEMS) delete local[Object.keys(local)[0]];
      writeLocal({ ...local, [product.id]: toSnapshot(product) });
      return;
    }
    try {
      await api.post(`/wishlist/${product.id}`);
    } catch {
      set({ products: previous });
    }
  },

  remove: async (productId) => {
    const previous = get().products;
    const next = { ...previous };
    delete next[productId];
    set({ products: next });

    if (get().mode === 'guest') {
      const local = readLocal();
      delete local[productId];
      writeLocal(local);
      return;
    }
    try {
      await api.delete(`/wishlist/${productId}`);
    } catch {
      set({ products: previous });
    }
  },

  loadGuest: () => set({ mode: 'guest', products: readLocal(), ready: true }),

  syncUser: async () => {
    const local = readLocal();
    const productIds = Object.keys(local);
    try {
      const res = productIds.length
        ? await api.post('/wishlist/merge', { productIds })
        : await api.get('/wishlist');
      // Only drop the local copy once the server has it.
      if (productIds.length) localStorage.removeItem(STORAGE_KEY);
      set({ mode: 'user', products: fromServer(res.data), ready: true });
    } catch {
      set({ mode: 'user', ready: true });
    }
  },
}));
