import { TransactionsTableRowType, AccountType, Account, Business } from '../components/transactions-table/types';

// Mock accounts
export const mockAccounts: Account[] = [
  { id: '1', __typename: 'FinancialAccount', name: 'Main Checking Account', type: AccountType.BankAccount },
  { id: '2', __typename: 'FinancialAccount', name: 'Business Credit Card', type: AccountType.CreditCard },
  { id: '3', __typename: 'FinancialAccount', name: 'Cash Register', type: AccountType.Cash },
  { id: '4', __typename: 'FinancialAccount', name: 'Bitcoin Wallet', type: AccountType.CryptoWallet },
  { id: '5', __typename: 'FinancialAccount', name: 'Investment Portfolio', type: AccountType.Investment },
  { id: '6', __typename: 'FinancialAccount', name: 'Business Loan', type: AccountType.Loan },
  { id: '7', __typename: 'FinancialAccount', name: 'Savings Account', type: AccountType.BankAccount },
  { id: '8', __typename: 'FinancialAccount', name: 'Ethereum Wallet', type: AccountType.CryptoWallet },
];

// Mock businesses
export const mockBusinesses: Business[] = [
  { id: '1', name: 'Amazon Web Services' },
  { id: '2', name: 'Google Cloud Platform' },
  { id: '3', name: 'Microsoft Office 365' },
  { id: '4', name: 'Starbucks Corporation' },
  { id: '5', name: 'WeWork Inc.' },
  { id: '6', name: 'Uber Technologies' },
  { id: '7', name: 'Apple Inc.' },
  { id: '8', name: 'Netflix Inc.' },
  { id: '9', name: 'Slack Technologies' },
  { id: '10', name: 'Zoom Video Communications' },
  { id: '11', name: 'Client ABC Ltd.' },
  { id: '12', name: 'Client XYZ Corp.' },
  { id: '13', name: 'Freelancer John Doe' },
  { id: '14', name: 'Electric Company' },
  { id: '15', name: 'Internet Provider' },
];

// Helper to create dates
const createDate = (daysAgo: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// Helper to get random account
const getRandomAccount = () => mockAccounts[Math.floor(Math.random() * mockAccounts.length)];

// Helper to get random business
const getRandomBusiness = () => mockBusinesses[Math.floor(Math.random() * mockBusinesses.length)];

// Helper to generate reference key
const generateReferenceKey = () => `TXN-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;

// Mock transactions
export const mockTransactionsData: TransactionsTableRowType[] = [
  // AWS payment
  {
    id: '1',
    chargeId: 'charge_1',
    eventDate: createDate(5),
    effectiveDate: createDate(3),
    sourceEffectiveDate: createDate(5),
    amount: { raw: -850.50, formatted: '-$850.50' },
    account: mockAccounts[0], // Main Checking
    sourceDescription: 'AWS Cloud Services - Monthly Bill',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[0], // AWS
    onUpdate: () => console.log('Updated transaction 1'),
    editTransaction: () => console.log('Edit transaction 1'),
    enableEdit: true,
    enableChargeLink: true,
  },
  
  // Client payment (income)
  {
    id: '2',
    chargeId: 'charge_2',
    eventDate: createDate(10),
    effectiveDate: createDate(8),
    amount: { raw: 5000.00, formatted: '$5,000.00' },
    account: mockAccounts[0], // Main Checking
    sourceDescription: 'Invoice Payment - Project Alpha',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[10], // Client ABC
    onUpdate: () => console.log('Updated transaction 2'),
    editTransaction: () => console.log('Edit transaction 2'),
    enableEdit: true,
    enableChargeLink: true,
  },

  // Credit card payment
  {
    id: '3',
    chargeId: 'charge_3',
    eventDate: createDate(15),
    effectiveDate: createDate(12),
    amount: { raw: -1200.75, formatted: '-$1,200.75' },
    account: mockAccounts[1], // Credit Card
    sourceDescription: 'Office Supplies and Equipment',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[6], // Apple
    onUpdate: () => console.log('Updated transaction 3'),
    editTransaction: () => console.log('Edit transaction 3'),
    enableEdit: true,
    enableChargeLink: false,
  },

  // Crypto transaction
  {
    id: '4',
    chargeId: 'charge_4',
    eventDate: createDate(20),
    effectiveDate: createDate(18),
    amount: { raw: 0.05, formatted: '0.05 BTC' },
    cryptoExchangeRate: { rate: 45000 },
    account: mockAccounts[3], // Bitcoin Wallet
    sourceDescription: 'Bitcoin Purchase',
    referenceKey: generateReferenceKey(),
    counterparty: null,
    missingInfoSuggestions: {
      business: { id: 'suggested_1', name: 'Coinbase Exchange' }
    },
    onUpdate: () => console.log('Updated transaction 4'),
    editTransaction: () => console.log('Edit transaction 4'),
    enableEdit: true,
    enableChargeLink: true,
  },

  // Subscription payment
  {
    id: '5',
    chargeId: 'charge_5',
    eventDate: createDate(7),
    effectiveDate: createDate(7),
    amount: { raw: -15.99, formatted: '-$15.99' },
    account: mockAccounts[1], // Credit Card
    sourceDescription: 'Netflix Monthly Subscription',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[7], // Netflix
    onUpdate: () => console.log('Updated transaction 5'),
    editTransaction: () => console.log('Edit transaction 5'),
    enableEdit: false,
    enableChargeLink: true,
  },

  // Cash transaction
  {
    id: '6',
    eventDate: createDate(3),
    effectiveDate: createDate(3),
    amount: { raw: -45.00, formatted: '-$45.00' },
    account: mockAccounts[2], // Cash
    sourceDescription: 'Coffee and lunch expenses',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[3], // Starbucks
    onUpdate: () => console.log('Updated transaction 6'),
    editTransaction: () => console.log('Edit transaction 6'),
    enableEdit: true,
    enableChargeLink: false,
  },

  // Missing counterparty transaction
  {
    id: '7',
    chargeId: 'charge_7',
    eventDate: createDate(12),
    effectiveDate: createDate(10),
    amount: { raw: -299.99, formatted: '-$299.99' },
    account: mockAccounts[0], // Main Checking
    sourceDescription: 'Unknown vendor payment - need to categorize',
    referenceKey: generateReferenceKey(),
    counterparty: null,
    missingInfoSuggestions: {
      business: { id: 'suggested_2', name: 'Tech Equipment Store' }
    },
    onUpdate: () => console.log('Updated transaction 7'),
    editTransaction: () => console.log('Edit transaction 7'),
    enableEdit: true,
    enableChargeLink: true,
  },

  // Large client payment
  {
    id: '8',
    chargeId: 'charge_8',
    eventDate: createDate(25),
    effectiveDate: createDate(23),
    amount: { raw: 15000.00, formatted: '$15,000.00' },
    account: mockAccounts[0], // Main Checking
    sourceDescription: 'Quarterly retainer payment',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[11], // Client XYZ
    onUpdate: () => console.log('Updated transaction 8'),
    editTransaction: () => console.log('Edit transaction 8'),
    enableEdit: false,
    enableChargeLink: true,
  },

  // Ethereum transaction
  {
    id: '9',
    chargeId: 'charge_9',
    eventDate: createDate(30),
    effectiveDate: createDate(28),
    amount: { raw: 2.5, formatted: '2.5 ETH' },
    cryptoExchangeRate: { rate: 3000 },
    account: mockAccounts[7], // Ethereum Wallet
    sourceDescription: 'Ethereum staking rewards',
    referenceKey: generateReferenceKey(),
    counterparty: null,
    onUpdate: () => console.log('Updated transaction 9'),
    editTransaction: () => console.log('Edit transaction 9'),
    enableEdit: true,
    enableChargeLink: false,
  },

  // Utility payment
  {
    id: '10',
    eventDate: createDate(2),
    effectiveDate: createDate(1),
    amount: { raw: -180.50, formatted: '-$180.50' },
    account: mockAccounts[0], // Main Checking
    sourceDescription: 'Monthly electricity bill',
    referenceKey: generateReferenceKey(),
    counterparty: mockBusinesses[13], // Electric Company
    onUpdate: () => console.log('Updated transaction 10'),
    editTransaction: () => console.log('Edit transaction 10'),
    enableEdit: true,
    enableChargeLink: true,
  },
];

// Large dataset for testing
export const mockLargeTransactionsData: TransactionsTableRowType[] = Array.from({ length: 100 }, (_, index) => {
  const baseTransaction = mockTransactionsData[index % mockTransactionsData.length];
  const amount = (Math.random() * 2000 - 1000); // Random amount between -1000 and 1000
  
  return {
    ...baseTransaction,
    id: `large_${index + 1}`,
    chargeId: `charge_large_${index + 1}`,
    eventDate: createDate(Math.floor(Math.random() * 365)),
    effectiveDate: createDate(Math.floor(Math.random() * 365)),
    amount: {
      raw: amount,
      formatted: amount > 0 ? `$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`
    },
    account: getRandomAccount(),
    sourceDescription: `Transaction ${index + 1} - ${baseTransaction.sourceDescription}`,
    referenceKey: generateReferenceKey(),
    counterparty: Math.random() > 0.2 ? getRandomBusiness() : null,
    missingInfoSuggestions: Math.random() > 0.7 ? {
      business: { id: `suggested_${index}`, name: `Suggested Business ${index}` }
    } : undefined,
    enableEdit: Math.random() > 0.3,
    enableChargeLink: Math.random() > 0.2,
  };
});

// Empty dataset
export const mockEmptyTransactionsData: TransactionsTableRowType[] = [];

// Single transaction dataset
export const mockSingleTransactionData: TransactionsTableRowType[] = [mockTransactionsData[0]];