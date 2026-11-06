// PRECOG / Trend Radar · Where PRECOG keeps things: JSON values under string keys. The app uses the browser's
// localStorage; tests (or a private window without storage) use memory. Nothing else touches localStorage.

/** The part of the Web Storage API PRECOG needs. */
export interface Backend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}
/** A backend that lives in memory: for tests, and when the browser refuses storage. */
export function memoryBackend(seed: Record<string, unknown> = {}): Backend & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: k => void data.delete(k),
    keys: () => [...data.keys()],
  };
}
/** The browser's localStorage, or memory when it is unavailable (some private windows, sandboxed frames). */
export function browserBackend(): Backend {
  try {
    const ls = globalThis.localStorage;
    ls.getItem('precog.probe');
    return {
      getItem: k => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: k => ls.removeItem(k),
      keys: () => Object.keys(ls),
    };
  } catch {
    return memoryBackend();
  }
}

let backend: Backend = browserBackend();
/** Points the store at another backend (tests use memoryBackend()). Returns it, for convenience. */
export function useBackend<B extends Backend>(b: B): B {
  backend = b;
  return b;
}
/** Removes every key matching a pattern; used to drop caches older versions wrote. */
export function dropKeys(pattern: RegExp): void {
  try {
    backend
      .keys()
      .filter(k => pattern.test(k))
      .forEach(k => backend.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
// Old cache formats no longer read; dropped first when storage is full.
const STALE = /^precog\.(reading\.v[12]|guardian\.v1|gdelt)\./;

/** JSON values by key. Reads never throw (they fall back to the default); writes never throw either. */
export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = backend.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try {
      backend.setItem(k, JSON.stringify(v));
    } catch {
      // Storage full: drop old caches, then try once more.
      dropKeys(STALE);
      try {
        backend.setItem(k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    }
  },
  remove(k: string): void {
    try {
      backend.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
};
