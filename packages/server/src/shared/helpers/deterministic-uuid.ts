import { randomUUID } from 'node:crypto';
import { v5 as uuidv5 } from 'uuid';

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function makeUUID(namespace: string, name: string): string {
  return uuidv5(`${namespace}:${name}`, NAMESPACE);
}

export function makeUUIDLegacy(seed?: string): string {
  if (seed === undefined || seed === null) {
    return randomUUID();
  }
  return makeUUID('legacy', seed);
}
