/**
 * The charges the e2e database holds, shared by the seed and the tests so a test can name the exact
 * rows a page should show.
 *
 * Every charge has one transaction on its own date, so sorting by date is a total order and a page
 * holds a known slice. Each group has its own counterparty and description prefix, so a free-text
 * filter on the prefix selects exactly that group (it matches the description and the counterparty
 * name, and nothing else in the database contains it).
 */

/** Page size of the All Charges list (`ALL_CHARGES_PAGE_SIZE`). */
export const PAGE_SIZE = 100;

export type ChargeGroup = {
  /** Free text that selects exactly this group. */
  search: string;
  counterparty: string;
  /** Descriptions in date order. */
  descriptions: string[];
  /** First charge's date; each next charge is one day later. */
  firstDate: string;
  /** Tag added to every `taggedEvery`-th charge. */
  tag?: { name: string; every: number };
};

const numbered = (prefix: string, count: number, width: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix} ${String(i + 1).padStart(width, '0')}`);

/** Over two pages: 150 charges, so page 0 holds 1–100 and page 1 holds 101–150. */
export const ACME: ChargeGroup = {
  search: 'acme',
  counterparty: 'Acme Supplies',
  descriptions: numbered('Acme charge', 150, 3),
  firstDate: '2025-01-01',
  tag: { name: 'Office', every: 10 },
};

/** One page. */
export const GLOBEX: ChargeGroup = {
  search: 'globex',
  counterparty: 'Globex Media',
  descriptions: numbered('Globex charge', 30, 2),
  firstDate: '2025-06-01',
  tag: { name: 'Marketing', every: 1 },
};

/** Two charges for the merge test, which merges them; no other test reads them. */
export const MERGEABLE: ChargeGroup = {
  search: 'mergeable',
  counterparty: 'Initech Partners',
  descriptions: ['Mergeable charge A', 'Mergeable charge B'],
  firstDate: '2025-08-01',
};

export const CHARGE_GROUPS = [ACME, GLOBEX, MERGEABLE] as const;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
