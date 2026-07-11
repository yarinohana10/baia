import { create } from 'zustand';
import { api } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

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
  fetchCart: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  getGuestSessionId: () => string;
  itemCount: () => number;
};

function getGuestSession(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('baia_guest_session');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('baia_guest_session', id);
  }
  return id;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  loading: false,

  getGuestSessionId: () => getGuestSession(),

  fetchCart: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/cart', {
        headers: { 'x-guest-session': getGuestSession() },
      });
      set({ items: res.data.items || [] });
    } catch {
      set({ items: [] });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (variantId, quantity) => {
    const res = await api.post(
      '/cart/items',
      { variantId, quantity },
      { headers: { 'x-guest-session': getGuestSession() } },
    );
    set({ items: res.data.items || [] });
  },

  updateQuantity: async (itemId, quantity) => {
    const res = await api.put(
      `/cart/items/${itemId}`,
      { quantity },
      { headers: { 'x-guest-session': getGuestSession() } },
    );
    set({ items: res.data.items || [] });
  },

  removeItem: async (itemId) => {
    const res = await api.delete(`/cart/items/${itemId}`, {
      headers: { 'x-guest-session': getGuestSession() },
    });
    set({ items: res.data.items || [] });
  },

  itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));
