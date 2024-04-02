import type { IGetAllBusinessesResult } from '../types.js';

export function filterBusinessByName(
  business: IGetAllBusinessesResult,
  name?: string | null,
): boolean {
  if (!name || name.trim() === '') {
    return true;
  }
  return `${business.name} ${business.hebrew_name}`.toLowerCase().includes(name.toLowerCase());
}
