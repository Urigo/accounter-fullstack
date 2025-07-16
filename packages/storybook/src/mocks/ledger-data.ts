import { LedgerRecordRow, Currency, Account, LedgerRecord } from '../components/ledger-table/types';

// Mock accounts
export const mockAccounts: Account[] = [
  { __typename: 'FinancialAccount', id: '1', name: 'Cash - Main Account' },
  { __typename: 'FinancialAccount', id: '2', name: 'Bank Account - Leumi' },
  { __typename: 'FinancialAccount', id: '3', name: 'Supplier - ABC Ltd' },
  { __typename: 'FinancialAccount', id: '4', name: 'Customer - XYZ Corp' },
  { __typename: 'FinancialAccount', id: '5', name: 'Office Rent' },
  { __typename: 'FinancialAccount', id: '6', name: 'Utilities' },
  { __typename: 'FinancialAccount', id: '7', name: 'Sales Revenue' },
  { __typename: 'FinancialAccount', id: '8', name: 'Equipment Purchase' },
  { __typename: 'FinancialAccount', id: '9', name: 'Professional Services' },
  { __typename: 'FinancialAccount', id: '10', name: 'Travel Expenses' },
];

// Helper function to create dates
const createDate = (daysAgo: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// Helper function to get random account
const getRandomAccount = (): Account => {
  return mockAccounts[Math.floor(Math.random() * mockAccounts.length)];
};

// Base ledger records
export const mockLedgerRecords: LedgerRecord[] = [
  {
    id: '1',
    debitAccount1: mockAccounts[0], // Cash
    creditAccount1: mockAccounts[6], // Sales Revenue
    debitAmount1: { formatted: '$1,000.00', currency: Currency.Usd },
    creditAmount1: { formatted: '$1,000.00', currency: Currency.Usd },
    localCurrencyDebitAmount1: { formatted: '₪3,500.00', raw: 3500 },
    localCurrencyCreditAmount1: { formatted: '₪3,500.00', raw: 3500 },
    invoiceDate: createDate(5),
    valueDate: createDate(3),
    description: 'Product sale to customer',
    reference: 'INV-2024-001',
    debitAccount2: null,
    creditAccount2: null,
    debitAmount2: null,
    creditAmount2: null,
    localCurrencyDebitAmount2: null,
    localCurrencyCreditAmount2: null,
  },
  {
    id: '2',
    debitAccount1: mockAccounts[4], // Office Rent
    creditAccount1: mockAccounts[1], // Bank Account
    debitAmount1: { formatted: '₪5,000.00', currency: Currency.Ils },
    creditAmount1: { formatted: '₪5,000.00', currency: Currency.Ils },
    localCurrencyDebitAmount1: { formatted: '₪5,000.00', raw: 5000 },
    localCurrencyCreditAmount1: { formatted: '₪5,000.00', raw: 5000 },
    invoiceDate: createDate(10),
    valueDate: createDate(8),
    description: 'Monthly office rent payment',
    reference: 'RENT-FEB-2024',
    debitAccount2: null,
    creditAccount2: null,
    debitAmount2: null,
    creditAmount2: null,
    localCurrencyDebitAmount2: null,
    localCurrencyCreditAmount2: null,
  },
  {
    id: '3',
    debitAccount1: mockAccounts[7], // Equipment
    debitAccount2: mockAccounts[5], // Utilities
    creditAccount1: mockAccounts[2], // Supplier
    creditAccount2: mockAccounts[1], // Bank Account
    debitAmount1: { formatted: '€2,500.00', currency: Currency.Eur },
    debitAmount2: { formatted: '₪800.00', currency: Currency.Ils },
    creditAmount1: { formatted: '€2,500.00', currency: Currency.Eur },
    creditAmount2: { formatted: '₪800.00', currency: Currency.Ils },
    localCurrencyDebitAmount1: { formatted: '₪9,750.00', raw: 9750 },
    localCurrencyDebitAmount2: { formatted: '₪800.00', raw: 800 },
    localCurrencyCreditAmount1: { formatted: '₪9,750.00', raw: 9750 },
    localCurrencyCreditAmount2: { formatted: '₪800.00', raw: 800 },
    invoiceDate: createDate(15),
    valueDate: createDate(12),
    description: 'Equipment purchase and utility bill',
    reference: 'PO-2024-045',
  },
  {
    id: '4',
    debitAccount1: mockAccounts[1], // Bank Account
    creditAccount1: mockAccounts[3], // Customer
    debitAmount1: { formatted: '$2,000.00', currency: Currency.Usd },
    creditAmount1: { formatted: '$2,000.00', currency: Currency.Usd },
    localCurrencyDebitAmount1: { formatted: '₪7,000.00', raw: 7000 },
    localCurrencyCreditAmount1: { formatted: '₪7,000.00', raw: 7000 },
    invoiceDate: createDate(20),
    valueDate: createDate(18),
    description: 'Customer payment received',
    reference: 'PAY-2024-012',
    debitAccount2: null,
    creditAccount2: null,
    debitAmount2: null,
    creditAmount2: null,
    localCurrencyDebitAmount2: null,
    localCurrencyCreditAmount2: null,
  },
  {
    id: '5',
    debitAccount1: mockAccounts[9], // Travel Expenses
    creditAccount1: mockAccounts[0], // Cash
    debitAmount1: { formatted: '₪1,200.00', currency: Currency.Ils },
    creditAmount1: { formatted: '₪1,200.00', currency: Currency.Ils },
    localCurrencyDebitAmount1: { formatted: '₪1,200.00', raw: 1200 },
    localCurrencyCreditAmount1: { formatted: '₪1,200.00', raw: 1200 },
    invoiceDate: createDate(7),
    valueDate: createDate(7),
    description: 'Business trip expenses',
    reference: 'TRV-2024-003',
    debitAccount2: null,
    creditAccount2: null,
    debitAmount2: null,
    creditAmount2: null,
    localCurrencyDebitAmount2: null,
    localCurrencyCreditAmount2: null,
  },
];

// Mock data with different validation states
export const mockLedgerData: LedgerRecordRow[] = [
  // Normal record (validated)
  {
    ...mockLedgerRecords[0],
    matchingStatus: undefined,
  },
  // Record with differences
  {
    ...mockLedgerRecords[1],
    matchingStatus: 'Diff' as const,
    diff: {
      ...mockLedgerRecords[1],
      debitAmount1: { formatted: '₪5,200.00', currency: Currency.Ils },
      localCurrencyDebitAmount1: { formatted: '₪5,200.00', raw: 5200 },
      description: 'Monthly office rent payment - corrected',
    },
  },
  // New record
  {
    ...mockLedgerRecords[2],
    matchingStatus: 'New' as const,
  },
  // Deleted record
  {
    ...mockLedgerRecords[3],
    matchingStatus: 'Deleted' as const,
  },
  // Normal record
  {
    ...mockLedgerRecords[4],
    matchingStatus: undefined,
  },
];

// Large dataset for testing
export const mockLargeLedgerData: LedgerRecordRow[] = Array.from({ length: 50 }, (_, index) => {
  const baseRecord = mockLedgerRecords[index % mockLedgerRecords.length];
  const statuses: (undefined | 'New' | 'Diff' | 'Deleted')[] = [undefined, undefined, undefined, 'New', 'Diff', 'Deleted'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    ...baseRecord,
    id: `${index + 10}`,
    matchingStatus: status,
    debitAccount1: getRandomAccount(),
    creditAccount1: getRandomAccount(),
    invoiceDate: createDate(Math.floor(Math.random() * 60)),
    valueDate: createDate(Math.floor(Math.random() * 60)),
    description: `Transaction ${index + 1} - ${baseRecord.description}`,
    reference: `REF-2024-${String(index + 1).padStart(3, '0')}`,
    ...(status === 'Diff' && {
      diff: {
        ...baseRecord,
        description: `Updated transaction ${index + 1}`,
        debitAmount1: { 
          formatted: `$${(Math.random() * 5000 + 100).toFixed(2)}`, 
          currency: Currency.Usd 
        },
      },
    }),
  };
});

// Empty dataset
export const mockEmptyLedgerData: LedgerRecordRow[] = [];

// Single record dataset
export const mockSingleRecordData: LedgerRecordRow[] = [mockLedgerData[0]];