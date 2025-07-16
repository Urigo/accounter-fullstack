import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { LedgerTable } from '../src/components/ledger-table';
import {
  mockEmptyLedgerData,
  mockLargeLedgerData,
  mockLedgerData,
  mockSingleRecordData,
} from '../src/mocks/ledger-data';

const meta = {
  title: 'Components/LedgerTable',
  component: LedgerTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A comprehensive ledger table for displaying accounting records with sorting, validation states, and diff highlighting. Built for double-entry bookkeeping.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of ledger records to display',
      control: 'object',
    },
    onAccountClick: {
      description: 'Callback when an account name is clicked',
      action: 'accountClicked',
    },
  },
} satisfies Meta<typeof LedgerTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with mixed validation states
export const Default: Story = {
  args: {
    data: mockLedgerData,
    onAccountClick: action('account-clicked'),
  },
};

// Empty state
export const Empty: Story = {
  args: {
    data: mockEmptyLedgerData,
    onAccountClick: action('account-clicked'),
  },
};

// Single record
export const SingleRecord: Story = {
  args: {
    data: mockSingleRecordData,
    onAccountClick: action('account-clicked'),
  },
};

// Large dataset for performance testing
export const LargeDataset: Story = {
  args: {
    data: mockLargeLedgerData,
    onAccountClick: action('account-clicked'),
  },
};

// Only validated records (no status indicators)
export const ValidatedRecords: Story = {
  args: {
    data: mockLedgerData.filter(record => !record.matchingStatus),
    onAccountClick: action('account-clicked'),
  },
};

// Only records with differences
export const RecordsWithDiffs: Story = {
  args: {
    data: mockLedgerData.filter(record => record.matchingStatus === 'Diff'),
    onAccountClick: action('account-clicked'),
  },
};

// Only new records
export const NewRecords: Story = {
  args: {
    data: mockLedgerData.filter(record => record.matchingStatus === 'New'),
    onAccountClick: action('account-clicked'),
  },
};

// Only deleted records
export const DeletedRecords: Story = {
  args: {
    data: mockLedgerData.filter(record => record.matchingStatus === 'Deleted'),
    onAccountClick: action('account-clicked'),
  },
};

// Custom styling showcase
export const ValidationStatesShowcase: Story = {
  render: () => (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-green-700">✅ Validated Records</h3>
        <LedgerTable
          data={mockLedgerData.filter(record => !record.matchingStatus)}
          onAccountClick={action('account-clicked')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-yellow-700">⚠️ Records with Differences</h3>
        <LedgerTable
          data={mockLedgerData.filter(record => record.matchingStatus === 'Diff')}
          onAccountClick={action('account-clicked')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-blue-700">🆕 New Records</h3>
        <LedgerTable
          data={mockLedgerData.filter(record => record.matchingStatus === 'New')}
          onAccountClick={action('account-clicked')}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-red-700">🗑️ Deleted Records</h3>
        <LedgerTable
          data={mockLedgerData.filter(record => record.matchingStatus === 'Deleted')}
          onAccountClick={action('account-clicked')}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Interactive example with custom account click handler
export const InteractiveExample: Story = {
  render: () => {
    const handleAccountClick = (accountId: string, accountName: string) => {
      alert(`Clicked account: ${accountName} (ID: ${accountId})`);
    };

    return (
      <div className="p-4">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900">Interactive Demo</h3>
          <p className="text-blue-700 text-sm">
            Click on any account name to see the interaction. In a real application, this would
            navigate to the account details.
          </p>
        </div>
        <LedgerTable data={mockLedgerData} onAccountClick={handleAccountClick} />
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

// Currency showcase
export const CurrencyShowcase: Story = {
  args: {
    data: mockLedgerData,
    onAccountClick: action('account-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows how different currencies (USD, EUR, ILS) are displayed with proper formatting and conversion to local currency.',
      },
    },
  },
};

// Sorting demonstration
export const SortingDemo: Story = {
  args: {
    data: mockLargeLedgerData.slice(0, 10),
    onAccountClick: action('account-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates sorting functionality. Click on any column header to sort. Multiple currencies and amounts are handled correctly.',
      },
    },
  },
};

// Complex double-entry showcase
export const DoubleEntryShowcase: Story = {
  args: {
    data: mockLedgerData.filter(record => record.debitAccount2 || record.creditAccount2),
    onAccountClick: action('account-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows complex double-entry transactions with multiple debit and credit accounts. Perfect for compound journal entries.',
      },
    },
  },
};
