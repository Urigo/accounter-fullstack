import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

// Mock the Currency enum to avoid GraphQL dependency
const Currency = {
  Ils: 'ILS',
  Usd: 'USD',
  Eur: 'EUR',
} as const;

// Copy the component types locally to avoid GraphQL imports
type AmountData = {
  foreignAmount?: {
    formatted: string;
    currency: string;
  } | null;
  localAmount?: {
    formatted: string;
  } | null;
};

type Props = AmountData & {
  diff?: AmountData;
};

// Copy the AmountCell component locally with mock Currency
const AmountCell = ({ foreignAmount, localAmount, diff }: Props): React.ReactElement => {
  const isForeign = foreignAmount != null && foreignAmount.currency !== Currency.Ils;
  const isLocalAmountDiff = diff && diff.localAmount?.formatted !== localAmount?.formatted;
  const isForeignAmountDiff = diff && diff.foreignAmount?.formatted !== foreignAmount?.formatted;

  return (
    <div className="flex flex-col">
      {(localAmount || isLocalAmountDiff) && (
        <>
          <div className="flex gap-2 items-center">
            {isForeign && (
              <p className={isForeignAmountDiff ? 'line-through' : ''}>{foreignAmount.formatted}</p>
            )}
            {isForeignAmountDiff && diff.foreignAmount && (
              <p className="border-2 border-yellow-500 rounded-md">
                {diff.foreignAmount.formatted}
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {localAmount != null && (
              <p className={isLocalAmountDiff ? 'line-through' : ''}>{localAmount.formatted}</p>
            )}
            {isLocalAmountDiff && diff.localAmount && (
              <p className="border-2 border-yellow-500 rounded-md">{diff.localAmount.formatted}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const meta = {
  title: 'Components/LedgerTable/AmountCell',
  component: AmountCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A component for displaying financial amounts with support for foreign currency and diff highlighting.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    localAmount: {
      description: 'Local amount (usually in ILS)',
      control: 'object',
    },
    foreignAmount: {
      description: 'Foreign currency amount',
      control: 'object',
    },
    diff: {
      description: 'Diff data to show changes with yellow border highlighting',
      control: 'object',
    },
  },
} satisfies Meta<typeof AmountCell>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic local amount only
export const LocalAmountOnly: Story = {
  args: {
    localAmount: {
      formatted: '₪1,234.56',
    },
  },
};

// Foreign amount with local conversion
export const ForeignWithLocal: Story = {
  args: {
    foreignAmount: {
      formatted: '$100.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '₪350.00',
    },
  },
};

// ILS amount (not considered foreign)
export const ILSAmount: Story = {
  args: {
    foreignAmount: {
      formatted: '₪1,000.00',
      currency: Currency.Ils,
    },
    localAmount: {
      formatted: '₪1,000.00',
    },
  },
};

// EUR amount with local conversion
export const EURWithLocal: Story = {
  args: {
    foreignAmount: {
      formatted: '€85.50',
      currency: Currency.Eur,
    },
    localAmount: {
      formatted: '₪325.75',
    },
  },
};

// Large amounts
export const LargeAmounts: Story = {
  args: {
    foreignAmount: {
      formatted: '$50,000.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '₪175,000.00',
    },
  },
};

// Negative amounts
export const NegativeAmounts: Story = {
  args: {
    foreignAmount: {
      formatted: '-$500.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '-₪1,750.00',
    },
  },
};

// With local amount diff
export const WithLocalDiff: Story = {
  args: {
    localAmount: {
      formatted: '₪1,000.00',
    },
    diff: {
      localAmount: {
        formatted: '₪1,200.00',
      },
    },
  },
};

// With foreign amount diff
export const WithForeignDiff: Story = {
  args: {
    foreignAmount: {
      formatted: '$100.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '₪350.00',
    },
    diff: {
      foreignAmount: {
        formatted: '$120.00',
        currency: Currency.Usd,
      },
    },
  },
};

// With both foreign and local diff
export const WithBothDiffs: Story = {
  args: {
    foreignAmount: {
      formatted: '$100.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '₪350.00',
    },
    diff: {
      foreignAmount: {
        formatted: '$120.00',
        currency: Currency.Usd,
      },
      localAmount: {
        formatted: '₪420.00',
      },
    },
  },
};

// Empty/null amounts
export const EmptyAmounts: Story = {
  args: {
    localAmount: null,
    foreignAmount: null,
  },
};

// Only foreign amount, no local
export const OnlyForeign: Story = {
  args: {
    foreignAmount: {
      formatted: '€1,500.00',
      currency: Currency.Eur,
    },
  },
};

// Complex diff scenario
export const ComplexDiffScenario: Story = {
  args: {
    foreignAmount: {
      formatted: '$1,000.00',
      currency: Currency.Usd,
    },
    localAmount: {
      formatted: '₪3,500.00',
    },
    diff: {
      foreignAmount: {
        formatted: '$1,100.00',
        currency: Currency.Usd,
      },
      localAmount: {
        formatted: '₪3,850.00',
      },
    },
  },
};

// All currencies showcase
export const AllCurrencies: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <div className="border-b pb-2">
        <h3 className="font-semibold mb-2">USD to ILS</h3>
        <AmountCell
          foreignAmount={{ formatted: '$1,000.00', currency: Currency.Usd }}
          localAmount={{ formatted: '₪3,500.00' }}
        />
      </div>
      <div className="border-b pb-2">
        <h3 className="font-semibold mb-2">EUR to ILS</h3>
        <AmountCell
          foreignAmount={{ formatted: '€850.00', currency: Currency.Eur }}
          localAmount={{ formatted: '₪3,250.00' }}
        />
      </div>
      <div className="border-b pb-2">
        <h3 className="font-semibold mb-2">ILS Only</h3>
        <AmountCell
          foreignAmount={{ formatted: '₪2,500.00', currency: Currency.Ils }}
          localAmount={{ formatted: '₪2,500.00' }}
        />
      </div>
      <div>
        <h3 className="font-semibold mb-2">With Diffs</h3>
        <AmountCell
          foreignAmount={{ formatted: '$500.00', currency: Currency.Usd }}
          localAmount={{ formatted: '₪1,750.00' }}
          diff={{
            foreignAmount: { formatted: '$600.00', currency: Currency.Usd },
            localAmount: { formatted: '₪2,100.00' },
          }}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
