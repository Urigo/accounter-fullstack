import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { TransactionsTable } from '../src/components/transactions-table';
import { AccountType } from '../src/components/transactions-table/types';
import {
  mockEmptyTransactionsData,
  mockLargeTransactionsData,
  mockSingleTransactionData,
  mockTransactionsData,
} from '../src/mocks/transactions-data';

const meta = {
  title: 'Components/TransactionsTable',
  component: TransactionsTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive transactions table for displaying and managing financial transactions with counterparty selection, crypto support, and charge linking. Built for accounting and bookkeeping systems.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of transaction records to display',
      control: 'object',
    },
    enableEdit: {
      description: 'Enable editing functionality for transactions',
      control: 'boolean',
    },
    enableChargeLink: {
      description: 'Enable linking to related charges',
      control: 'boolean',
    },
    onChange: {
      description: 'Callback when any transaction is updated',
      action: 'transaction-updated',
    },
  },
} satisfies Meta<typeof TransactionsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with mixed transaction types
export const Default: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Empty state
export const Empty: Story = {
  args: {
    data: mockEmptyTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Single transaction
export const SingleTransaction: Story = {
  args: {
    data: mockSingleTransactionData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Large dataset for performance testing
export const LargeDataset: Story = {
  args: {
    data: mockLargeTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Read-only mode (no editing)
export const ReadOnly: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: false,
    enableChargeLink: false,
    onChange: action('transactions-updated'),
  },
};

// Edit only (no charge links)
export const EditOnly: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: false,
    onChange: action('transactions-updated'),
  },
};

// Charge links only (no editing)
export const ChargeLinksOnly: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: false,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Income transactions only
export const IncomeTransactions: Story = {
  args: {
    data: mockTransactionsData.filter(t => t.amount && t.amount.raw > 0),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Expense transactions only
export const ExpenseTransactions: Story = {
  args: {
    data: mockTransactionsData.filter(t => t.amount && t.amount.raw < 0),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Crypto transactions only
export const CryptoTransactions: Story = {
  args: {
    data: mockTransactionsData.filter(t => t.cryptoExchangeRate),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Transactions with missing counterparties
export const MissingCounterparties: Story = {
  args: {
    data: mockTransactionsData.filter(t => !t.counterparty),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// Account types showcase
export const AccountTypesShowcase: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  render: () => (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-blue-700">🏦 Bank Account Transactions</h3>
        <TransactionsTable
          data={mockTransactionsData.filter(t => t.account.type === AccountType.BankAccount)}
          enableEdit={true}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-purple-700">💳 Credit Card Transactions</h3>
        <TransactionsTable
          data={mockTransactionsData.filter(t => t.account.type === AccountType.CreditCard)}
          enableEdit={true}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-orange-700">₿ Crypto Wallet Transactions</h3>
        <TransactionsTable
          data={mockTransactionsData.filter(t => t.account.type === AccountType.CryptoWallet)}
          enableEdit={true}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-green-700">💵 Cash Transactions</h3>
        <TransactionsTable
          data={mockTransactionsData.filter(t => t.account.type === AccountType.Cash)}
          enableEdit={true}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Interactive example with custom handlers
export const InteractiveExample: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  render: () => {
    const handleTransactionUpdate = () => {
      alert('Transaction updated! In a real application, this would refresh the data.');
    };

    return (
      <div className="p-4">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900">Interactive Demo</h3>
          <p className="text-blue-700 text-sm mb-2">
            This demo shows the interactive features of the transactions table:
          </p>
          <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
            <li>Click counterparty names to view business details</li>
            <li>Use the counterparty dropdown to assign or create businesses</li>
            <li>Click the checkmark to approve suggested counterparties</li>
            <li>Click edit icons to modify transactions</li>
            <li>Click external link icons to view related charges</li>
            <li>Click column headers to sort data</li>
          </ul>
        </div>
        <TransactionsTable
          data={mockTransactionsData}
          enableEdit={true}
          enableChargeLink={true}
          onChange={handleTransactionUpdate}
        />
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

// Sorting demonstration
export const SortingDemo: Story = {
  args: {
    data: mockLargeTransactionsData.slice(0, 15),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sorting functionality. Click on any column header to sort. Dates, amounts, and text fields are all sortable.',
      },
    },
  },
};

// Crypto showcase
export const CryptoShowcase: Story = {
  args: {
    data: mockTransactionsData.filter(t => t.cryptoExchangeRate),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows cryptocurrency transactions with exchange rates and USD equivalent values. Perfect for crypto accounting.',
      },
    },
  },
};

// Business suggestions showcase
export const SuggestionsShowcase: Story = {
  args: {
    data: mockTransactionsData.filter(t => t.missingInfoSuggestions?.business),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates AI-powered business suggestions for transactions. Suggested businesses appear with star icons and can be approved with one click.',
      },
    },
  },
};

// Mixed permissions showcase
export const MixedPermissions: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  render: () => (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-green-700">
          ✏️ Full Access (Edit + Charge Links)
        </h3>
        <TransactionsTable
          data={mockTransactionsData.slice(0, 3)}
          enableEdit={true}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-blue-700">✏️ Edit Only</h3>
        <TransactionsTable
          data={mockTransactionsData.slice(3, 6)}
          enableEdit={true}
          enableChargeLink={false}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-orange-700">🔗 Charge Links Only</h3>
        <TransactionsTable
          data={mockTransactionsData.slice(6, 9)}
          enableEdit={false}
          enableChargeLink={true}
          onChange={action('transactions-updated')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-700">👁️ View Only</h3>
        <TransactionsTable
          data={mockTransactionsData.slice(9)}
          enableEdit={false}
          enableChargeLink={false}
          onChange={action('transactions-updated')}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
