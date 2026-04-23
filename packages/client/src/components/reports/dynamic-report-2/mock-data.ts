import type { CustomData, FlatNode, LedgerRecord, Owner, Template } from './types.js';

export const mockOwners: Owner[] = [
  { id: 'owner-1', name: 'John Smith' },
  { id: 'owner-2', name: 'Sarah Johnson' },
  { id: 'owner-3', name: 'Michael Chen' },
];

export const mockTemplates: Template[] = [
  { id: 'tpl-1', name: 'Q1 2024 Report', lastUpdated: new Date('2024-03-15'), isLocked: false },
  { id: 'tpl-2', name: 'Annual Summary', lastUpdated: new Date('2024-01-10'), isLocked: true },
  {
    id: 'tpl-3',
    name: 'Tax Report Template',
    lastUpdated: new Date('2024-02-20'),
    isLocked: false,
  },
  {
    id: 'tpl-4',
    name: 'Legacy Format Report',
    lastUpdated: new Date('2023-06-01'),
    isLocked: false,
    isLegacy: true,
  },
  { id: 'tpl-5', name: 'Standard Audit', lastUpdated: new Date('2024-04-01'), isLocked: true },
];

export const mockBankTree: FlatNode<CustomData>[] = [
  {
    id: 'sc-100',
    parent: 'bank',
    text: '100 — Assets',
    droppable: true,
    data: { nodeType: 'sort-code-branch', sortCode: 100, isOpen: false },
  },
  {
    id: 'entity-1',
    parent: 'sc-100',
    text: 'Cash & Equivalents Ltd',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: 125_000,
      entityType: 'business',
      sortCode: 100,
      isOpen: false,
    },
  },
  {
    id: 'entity-2',
    parent: 'sc-100',
    text: 'Bank Deposits Corp',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: 340_000,
      entityType: 'business',
      sortCode: 100,
      isOpen: false,
    },
  },
  {
    id: 'entity-3',
    parent: 'sc-100',
    text: 'Investment Holdings',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: -45_000,
      entityType: 'business',
      sortCode: 100,
      isOpen: false,
    },
  },
  {
    id: 'sc-200',
    parent: 'bank',
    text: '200 — Liabilities',
    droppable: true,
    data: { nodeType: 'sort-code-branch', sortCode: 200, isOpen: false },
  },
  {
    id: 'entity-4',
    parent: 'sc-200',
    text: 'Accounts Payable Inc',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: -89_000,
      entityType: 'business',
      sortCode: 200,
      isOpen: false,
    },
  },
  {
    id: 'entity-5',
    parent: 'sc-200',
    text: 'Long-term Debt Services',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: -250_000,
      entityType: 'business',
      sortCode: 200,
      isOpen: false,
    },
  },
  {
    id: 'sc-300',
    parent: 'bank',
    text: '300 — Revenue',
    droppable: true,
    data: { nodeType: 'sort-code-branch', sortCode: 300, isOpen: false },
  },
  {
    id: 'entity-6',
    parent: 'sc-300',
    text: 'Sales Revenue Co',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: 780_000,
      entityType: 'business',
      sortCode: 300,
      isOpen: false,
    },
  },
  {
    id: 'entity-7',
    parent: 'sc-300',
    text: 'Service Income LLC',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: 156_000,
      entityType: 'business',
      sortCode: 300,
      isOpen: false,
    },
  },
  {
    id: 'sc-400',
    parent: 'bank',
    text: '400 — Expenses',
    droppable: true,
    data: { nodeType: 'sort-code-branch', sortCode: 400, isOpen: false },
  },
  {
    id: 'entity-8',
    parent: 'sc-400',
    text: 'Operating Costs Ltd',
    droppable: false,
    data: {
      nodeType: 'financial-entity',
      value: -320_000,
      entityType: 'business',
      sortCode: 400,
      isOpen: false,
    },
  },
  {
    id: 'entity-ind-1',
    parent: 'bank',
    text: 'Freelance Consultant',
    droppable: false,
    data: { nodeType: 'financial-entity', value: 45_000, entityType: 'person', isOpen: false },
  },
  {
    id: 'entity-ind-2',
    parent: 'bank',
    text: 'Miscellaneous Holdings',
    droppable: false,
    data: { nodeType: 'financial-entity', value: 12_500, entityType: 'business', isOpen: false },
  },
];

export const mockReportTree: FlatNode<CustomData>[] = [
  {
    id: 'report-branch-1',
    parent: 'report',
    text: 'Operating Income',
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  },
  {
    id: 'report-entity-1',
    parent: 'report-branch-1',
    text: 'Primary Revenue Stream',
    droppable: false,
    data: { nodeType: 'financial-entity', value: 450_000, entityType: 'business', isOpen: false },
  },
  {
    id: 'report-entity-2',
    parent: 'report-branch-1',
    text: 'Secondary Income',
    droppable: false,
    data: { nodeType: 'financial-entity', value: 125_000, entityType: 'business', isOpen: false },
  },
  {
    id: 'report-branch-2',
    parent: 'report',
    text: 'Cost Centers',
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  },
  {
    id: 'nested-branch',
    parent: 'report-branch-2',
    text: 'Administrative',
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: false },
  },
  {
    id: 'report-entity-3',
    parent: 'nested-branch',
    text: 'Office Expenses',
    droppable: false,
    data: { nodeType: 'financial-entity', value: -85_000, entityType: 'business', isOpen: false },
  },
  {
    id: 'report-entity-4',
    parent: 'report-branch-2',
    text: 'Marketing Budget',
    droppable: false,
    data: { nodeType: 'financial-entity', value: -120_000, entityType: 'business', isOpen: false },
  },
];

export function generateMockLedgerRecords(entityId: string): LedgerRecord[] {
  const records: LedgerRecord[] = [];
  const businesses = ['ABC Corp', 'XYZ Ltd', 'Global Inc', 'Local Services'];
  const details = ['Invoice payment', 'Monthly fee', 'Service charge', 'Refund', 'Transfer'];

  for (let i = 0; i < 5; i++) {
    const amount = Math.round((Math.random() * 10_000 - 5000) * 100) / 100;
    records.push({
      id: `${entityId}-ledger-${i}`,
      business: businesses[Math.floor(Math.random() * businesses.length)],
      date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
        .toISOString()
        .split('T')[0],
      localAmount: amount,
      localAmountBalance: Math.round(Math.random() * 50_000 * 100) / 100,
      reference: `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      details: details[Math.floor(Math.random() * details.length)],
      counterAccount: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    });
  }

  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
