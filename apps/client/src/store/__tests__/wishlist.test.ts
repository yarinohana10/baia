import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LEGACY_STORAGE_KEY, readLocal, STORAGE_KEY, useWishlistStore } from '../wishlist';
import { api } from '@/lib/api';

/** A Map-backed localStorage for the node test environment. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const product = { id: 'p1', nameHe: 'גל', nameEn: 'Wave', slug: 'wave', basePrice: '199', images: [], variants: [] };

describe('wishlist local storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses a versioned key', () => {
    expect(STORAGE_KEY).toMatch(/:v\d+$/);
  });

  it('moves a list saved under the old key to the versioned one', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ p1: product }));
    expect(readLocal()).toEqual({ p1: product });
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ p1: product });
  });

  it('never overwrites a versioned list with the old one', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ p1: product }));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({}));
    expect(readLocal()).toEqual({ p1: product });
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupt or non-object data', () => {
    localStorage.setItem(STORAGE_KEY, '[1,2]');
    expect(readLocal()).toEqual({});
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(readLocal()).toEqual({});
  });
});

describe('guest wishlist refresh', () => {
  const other = { ...product, id: 'p2', slug: 'reef' };

  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ p1: product, p2: other }));
    useWishlistStore.setState({ mode: 'guest', products: readLocal(), ready: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('drops products that were hidden since, and picks up Back Soon', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.endsWith('/wave')) return { data: { ...product, backSoon: true } };
      throw { response: { status: 404 } };
    });
    await useWishlistStore.getState().refreshGuest();
    expect(Object.keys(useWishlistStore.getState().products)).toEqual(['p1']);
    expect(useWishlistStore.getState().products.p1.backSoon).toBe(true);
    expect(Object.keys(readLocal())).toEqual(['p1']);
  });

  it('keeps the list when the network fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'));
    await useWishlistStore.getState().refreshGuest();
    expect(Object.keys(useWishlistStore.getState().products).sort()).toEqual(['p1', 'p2']);
  });
});
