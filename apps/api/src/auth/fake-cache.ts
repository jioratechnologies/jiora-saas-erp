/** In-memory stand-in for CacheService (get/set/mget/incr). `down` simulates Redis being unavailable. */
export function fakeCache(down = false) {
  const store = new Map<string, any>();
  return {
    store,
    mget: jest.fn(async (keys: string[]) => (down ? keys.map(() => null) : keys.map((k) => (store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null)))),
    set: jest.fn(async (k: string, v: any) => {
      if (!down) store.set(k, v);
    }),
    incr: jest.fn(async (k: string) => {
      if (down) return null;
      const n = (store.get(k) ?? 0) + 1;
      store.set(k, n);
      return n;
    }),
    del: jest.fn(),
    delByPrefix: jest.fn(),
  };
}

