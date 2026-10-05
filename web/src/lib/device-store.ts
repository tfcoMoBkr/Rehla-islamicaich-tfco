import { useSyncExternalStore } from "react";

/*
 * A value kept in this browser only (localStorage), read through useSyncExternalStore so every
 * component that shows it updates together. This module sends nothing to a server; of the stores
 * built on it, only the tour flag is carried to an account (src/lib/account/sync.ts). When storage
 * is blocked, the value still holds in memory until the page is left.
 */

export type DeviceStore<T> = {
  use: () => T | null;
  read: () => T | null;
  set: (value: T | null) => void;
  /** For stores built on this one; components use `use`. */
  subscribe: (listener: () => void) => () => void;
};

export function deviceStore<T>(key: string, parse: (raw: string) => T | null, serialize: (value: T) => string): DeviceStore<T> {
  const listeners = new Set<() => void>();
  let inMemory: string | null = null;
  // useSyncExternalStore needs the same snapshot for an unchanged value.
  let cached: { raw: string | null; value: T | null } = { raw: null, value: null };

  function raw(): string | null {
    try {
      return window.localStorage.getItem(key) ?? inMemory;
    } catch {
      return inMemory;
    }
  }

  function read(): T | null {
    const current = raw();
    if (current !== cached.raw) {
      let value: T | null = null;
      try {
        value = current === null ? null : parse(current);
      } catch {
        value = null;
      }
      cached = { raw: current, value };
    }
    return cached.value;
  }

  function set(value: T | null): void {
    inMemory = value === null ? null : serialize(value);
    try {
      if (inMemory === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, inMemory);
    } catch {
      // Storage blocked: the in-memory value holds until the page is left.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { use: () => useSyncExternalStore(subscribe, read, () => null), read, set, subscribe };
}

export const textStore = (key: string) => deviceStore<string>(key, (raw) => raw, (value) => value);
