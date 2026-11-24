import { randomUUID } from 'node:crypto';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ACCOUNT_NUMBER = /"(accountNumber|account_number)":"([^"]+)"/g;

/**
 * A copy of a fixture in which every id is new, and every account number unique.
 *
 * Fixtures carry fixed ids, so two test files that insert the same fixture at the same time
 * collide: one waits on the other's uncommitted rows, and a suite that commits and then deletes
 * the fixture pulls rows out from under the other. A copy with ids of its own has no such
 * neighbours. `idOf` gives the new id that stands for an id of the original fixture.
 */
export function withFreshIds<T>(fixture: T): { fixture: T; idOf: (originalId: string) => string } {
  const ids = new Map<string, string>();
  const idOf = (originalId: string): string => {
    const key = originalId.toLowerCase();
    let fresh = ids.get(key);
    if (!fresh) {
      fresh = randomUUID();
      ids.set(key, fresh);
    }
    return fresh;
  };
  // An account is referred to by its number wherever it is used (a transaction's account, a tax
  // category mapping), so the number is replaced wherever it appears as a whole value.
  const suffix = randomUUID().slice(0, 8);
  let copy = JSON.stringify(fixture).replace(UUID, idOf);
  const accountNumbers = new Set([...copy.matchAll(ACCOUNT_NUMBER)].map(match => match[2]!));
  for (const accountNumber of accountNumbers) {
    copy = copy.replaceAll(JSON.stringify(accountNumber), JSON.stringify(`${accountNumber}-${suffix}`));
  }
  return { fixture: JSON.parse(copy) as T, idOf };
}
