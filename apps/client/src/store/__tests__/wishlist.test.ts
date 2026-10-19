import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_STORAGE_KEY, readLocal, STORAGE_KEY } from '../wishlist';

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
