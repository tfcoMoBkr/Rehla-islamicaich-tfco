import { cache } from "react";

/**
 * Content does not change while the app runs. In production each file is read and validated once
 * per process and shared by every request; in development it is read again for each request, so an
 * edited content file shows up without a restart.
 */
export function memo<Args extends readonly (string | number)[], T>(
  load: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  if (process.env.NODE_ENV !== "production") return cache(load);
  const results = new Map<string, Promise<T>>();
  return (...args) => {
    const key = args.join("/");
    const known = results.get(key);
    if (known) return known;
    const result = load(...args);
    results.set(key, result);
    // A failed read is not remembered, so the next request tries again.
    result.catch(() => results.delete(key));
    return result;
  };
}
