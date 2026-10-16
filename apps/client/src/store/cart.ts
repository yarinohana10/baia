import { create } from 'zustand';
import { api } from '@/lib/api';

type CartItem = {
  id: string;
  quantity: number;
  variant: {
    id: string;
    color: string;
    size: string;
    sku: string;
    stockQuantity: number;
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
      images: { url: string }[];
    };
  };
};

type CartStore = {
  items: CartItem[];
  loading: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  fetchCart: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  itemCount: () => number;
};

// Guest carts are identified by an httpOnly cookie the API sets on the first
// add (sent automatically via withCredentials) — no id is kept in JS.

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  loading: false,
  drawerOpen: false,
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
      set({ loading: false });
    }
  },

  addItem: async (variantId, quantity) => {
    const res = await api.post('/cart/items', { variantId, quantity });
    set({ items: res.data.items || [] });
  },

  updateQuantity: async (itemId, quantity) => {
    const res = await api.put(`/cart/items/${itemId}`, { quantity });
    set({ items: res.data.items || [] });
  },

  removeItem: async (itemId) => {
    const res = await api.delete(`/cart/items/${itemId}`);
    set({ items: res.data.items || [] });
  },

  // After sign-in: moves the guest cart (from the cookie) into the account,
  // server-side, respecting stock. A no-op when there is no guest cart.
  mergeGuestCart: async () => {
    const res = await api.post('/cart/merge');
    set({ items: res.data.cart?.items || [] });
  },

  itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
