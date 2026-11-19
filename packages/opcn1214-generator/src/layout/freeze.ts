/**
 * Freezes a value and every object reachable through its own properties. A Map is frozen as an
 * object only (its entries stay mutable at runtime); layouts expose it as a ReadonlyMap.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
