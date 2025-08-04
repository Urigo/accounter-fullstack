import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { MondayTransactionsTable } from '../src/components/transactions-table/MondayTransactionsTable';
import { AccountType } from '../src/components/transactions-table/types';
import {
  mockEmptyTransactionsData,
  mockLargeTransactionsData,
  mockTransactionsData,
} from '../src/mocks/transactions-data';

const meta = {
  title: '🎨 Monday.com Style/TransactionsTable',
  component: MondayTransactionsTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '✨ A stunning Monday.com inspired transactions table with beautiful cards, smart grouping, and elegant interactions. This modern design transforms boring data into visually appealing, interactive cards.',
      },
    },
    backgrounds: {
      default: 'monday-bg',
      values: [
        {
          name: 'monday-bg',
          value: '#f8fafc',
        },
        {
          name: 'white',
          value: '#ffffff',
        },
      ],
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of transaction records to display as beautiful cards',
      control: 'object',
    },
    enableEdit: {
      description: 'Enable elegant editing functionality',
      control: 'boolean',
    },
    enableChargeLink: {
      description: 'Enable smooth charge navigation',
      control: 'boolean',
    },
    onChange: {
      description: 'Callback when transactions are updated',
      action: 'transaction-updated',
    },
  },
} satisfies Meta<typeof MondayTransactionsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// 🎨 Default Monday.com style showcase
export const MondayStyleDefault: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
};

// 💰 Income & Expense Showcase
export const IncomeExpenseShowcase: Story = {
  args: {
    data: [
      ...mockTransactionsData.filter(t => t.amount && t.amount.raw > 0).slice(0, 3),
      ...mockTransactionsData.filter(t => t.amount && t.amount.raw < 0).slice(0, 3),
    ],
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          '💚 Green amounts for income, ❤️ red amounts for expenses. Beautiful color coding makes financial data instantly readable.',
      },
    },
  },
};

// 🏦 Account Types Gallery
export const AccountTypesGallery: Story = {
  args: {
    data: [
      mockTransactionsData.find(t => t.account.type === AccountType.BankAccount),
      mockTransactionsData.find(t => t.account.type === AccountType.CreditCard),
      mockTransactionsData.find(t => t.account.type === AccountType.CryptoWallet),
      mockTransactionsData.find(t => t.account.type === AccountType.Cash),
    ].filter((t): t is (typeof mockTransactionsData)[number] => t !== undefined),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          '🎨 Each account type gets its own beautiful color: 🏦 Blue for banks, 💳 Purple for credit cards, ₿ Orange for crypto, 💵 Green for cash.',
      },
    },
  },
};

// 🤖 AI Suggestions Demo
export const AISuggestionsDemo: Story = {
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
          '🤖 Smart AI suggestions with elegant approval buttons. One-click to accept suggested counterparties!',
      },
    },
  },
};

// ₿ Crypto Transactions Special
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
          '₿ Crypto transactions with exchange rates and USD conversions. Perfect for modern financial tracking!',
      },
    },
  },
};

// 📱 Large Dataset Performance
export const LargeDatasetDemo: Story = {
  args: {
    data: mockLargeTransactionsData.slice(0, 20),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          '🚀 Smooth performance even with large datasets. Smart grouping keeps everything organized!',
      },
    },
  },
};

// 🎭 Permission Variations
export const PermissionShowcase: Story = {
  args: {
    data: mockTransactionsData.slice(0, 6).map((t, index) => ({
      ...t,
      enableEdit: index < 3,
      enableChargeLink: index % 2 === 0,
    })),
    enableEdit: false,
    enableChargeLink: false,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story:
          '🔐 Different permission levels with elegant action button reveals. Hover to see edit/link options!',
      },
    },
  },
};

// 🌟 Interactive Playground
export const InteractivePlayground: Story = {
  args: {
    data: mockTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  render: args => {
    return (
      <div>
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 mb-6 rounded-xl">
          <h2 className="text-2xl font-bold mb-2">🌟 Interactive Monday.com Style Demo</h2>
          <p className="text-blue-100 mb-4">
            Experience the beautiful, modern interface with these interactive features:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>Hover cards for action buttons</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                <span>Click counterparty names to navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                <span>Smart grouping controls</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <span>AI suggestions with approval</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                <span>Color-coded account types</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span>Crypto conversion display</span>
              </div>
            </div>
          </div>
        </div>
        <MondayTransactionsTable {...args} />
      </div>
    );
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          '🎮 Full interactive experience with all features enabled. This is Monday.com level beautiful!',
      },
    },
  },
};

// 🌙 Empty State Beauty
export const EmptyStateShowcase: Story = {
  args: {
    data: mockEmptyTransactionsData,
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  parameters: {
    docs: {
      description: {
        story: '🌙 Even empty states look beautiful with friendly messaging and elegant design.',
      },
    },
  },
};

// 🎨 Color Palette Demo
export const ColorPaletteDemo: Story = {
  args: {
    data: mockTransactionsData.slice(0, 8),
    enableEdit: true,
    enableChargeLink: true,
    onChange: action('transactions-updated'),
  },
  render: args => (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-white rounded-xl border">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 border-2 border-blue-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
            🏦
          </div>
          <div className="text-sm font-medium text-blue-800">Bank Account</div>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 border-2 border-purple-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
            💳
          </div>
          <div className="text-sm font-medium text-purple-800">Credit Card</div>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-100 border-2 border-orange-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
            ₿
          </div>
          <div className="text-sm font-medium text-orange-800">Crypto Wallet</div>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 border-2 border-green-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
            💵
          </div>
          <div className="text-sm font-medium text-green-800">Cash</div>
        </div>
      </div>
      <MondayTransactionsTable {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '🎨 Beautiful color palette showcase with consistent, meaningful color coding throughout the interface.',
      },
    },
  },
};
