import type { SourceType } from '../../shared/source-types.js';
import type { VaultChangeItem, VaultChanges } from '../../shared/types.js';
import { SOURCE_LABELS } from '../screens/config/source-types.js';

const SETTING_LABELS: Record<string, string> = {
  showBrowser: 'Show browser',
  fetchBankOfIsraelRates: 'Bank of Israel rates',
  concurrentScraping: 'Concurrent scraping',
  defaultDateRangeMonths: 'Default date range',
  persistHistory: 'Save run history',
  historyFilePath: 'History file path',
  serverUrl: 'Server URL',
  apiKey: 'API key',
};

export const SECTION_LABELS: Record<VaultChangeItem['section'], string> = {
  sources: 'Credentials',
  accounts: 'Accounts',
  settings: 'Settings',
};

export const KIND_MARKS: Record<VaultChangeItem['kind'], string> = {
  added: '+',
  edited: '~',
  removed: '−',
};

const KIND_WORDS: Record<VaultChangeItem['kind'], string> = {
  added: 'added',
  edited: 'edited',
  removed: 'removed',
};

export function describeChange(item: VaultChangeItem): string {
  if (item.section === 'settings') return SETTING_LABELS[item.id] ?? item.id;
  const type = item.sourceType ? SOURCE_LABELS[item.sourceType as SourceType] : undefined;
  if (item.section === 'accounts') return `${type ? `${type} ` : ''}account ${item.label}`;
  return type ? `${type}: ${item.label}` : item.label;
}

export function describeKind(item: VaultChangeItem): string {
  return KIND_WORDS[item.kind];
}

export function groupChanges(
  changes: VaultChanges | null,
): { section: VaultChangeItem['section']; items: VaultChangeItem[] }[] {
  const order: VaultChangeItem['section'][] = ['sources', 'accounts', 'settings'];
  return order
    .map(section => ({
      section,
      items: changes?.items.filter(i => i.section === section) ?? [],
    }))
    .filter(g => g.items.length > 0);
}

/** The change kind recorded for a given source or account id, if any. */
export function changeFor(
  changes: VaultChanges | null,
  section: VaultChangeItem['section'],
  id: string,
): VaultChangeItem['kind'] | null {
  return changes?.items.find(i => i.section === section && i.id === id)?.kind ?? null;
}

export function hasSectionChanges(
  changes: VaultChanges | null,
  section: VaultChangeItem['section'],
): boolean {
  return !!changes?.items.some(i => i.section === section);
}
