import { useState, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AccountantStatus,
  Currency,
  LedgerValidationStatus,
  MissingChargeInfo,
} from '../../gql/graphql.js';
import { CHARGE_TYPE_NAME, type ChargeType } from '../../helpers/index.js';
import { visibleFields } from './charge-fields.js';
import { ChargeRecord } from './charge-record.js';
import type { ChargeRow } from './charges-table.js';
import type { ChargeDensity } from './use-charge-density.js';

/** Row order copied from the spec spreadsheet so this reads alongside the Spec Matrix story. */
const SHEET_ORDER: ChargeType[] = [
  'BankDepositCharge',
  'BusinessTripCharge',
  'CommonCharge',
  'ConversionCharge',
  'CreditcardBankCharge',
  'DividendCharge',
  'FinancialCharge',
  'ForeignSecuritiesCharge',
  'InternalTransferCharge',
  'MonthlyVatCharge',
  'SalaryCharge',
];

/**
 * Every field populated. Because the matrix decides visibility rather than the data, a fully-loaded
 * fixture is exactly what proves suppression: whatever a record omits, it omits by spec.
 */
function makeRow(type: ChargeType, overrides: Partial<ChargeRow> = {}): ChargeRow {
  return {
    id: `charge-${type}`,
    type,
    dates: {
      date: new Date('2026-03-03'),
      mostMinDate: new Date('2026-03-01'),
      mostMaxDate: new Date('2026-03-05'),
    },
    amount: { value: -1180.5, currency: Currency.Ils, shouldValidate: false },
    vat: { value: 180.5, currency: Currency.Ils },
    counterparty: { id: 'biz-1', name: 'Google Cloud EMEA' },
    description: 'Monthly cloud spend',
    tags: [
      { id: 't1', name: 'saas', namePath: ['expenses', 'software'] },
      { id: 't2', name: 'infra' },
    ],
    suggestedTags: [],
    taxCategory: { id: 'tc-1', name: 'Cloud Infrastructure' },
    businessTrip: { id: 'trip-1', name: 'Berlin Q1 Summit' },
    counts: {
      transactions: 2,
      documents: 1,
      ledger: 4,
      miscExpenses: 0,
      invalidLedger: LedgerValidationStatus.Valid,
    },
    missingInfo: [],
    accountantApproval: AccountantStatus.Unapproved,
    ...overrides,
  };
}

/** Renders records in a list, the way `ChargesTable` does, so alignment across them is visible. */
function RecordList({
  rows,
  density = 'comfortable',
}: {
  rows: ChargeRow[];
  density?: ChargeDensity;
}): ReactElement {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <ul className="w-full divide-y rounded-md border">
      {rows.map(row => (
        <ChargeRecord
          key={row.id}
          row={row}
          isSelected={!!selected[row.id]}
          isExpanded={!!expanded[row.id]}
          density={density}
          onSelectedChange={value => setSelected(s => ({ ...s, [row.id]: value }))}
          onToggleExpanded={() => setExpanded(e => ({ ...e, [row.id]: !e[row.id] }))}
          onCollapse={() => setExpanded(e => ({ ...e, [row.id]: false }))}
          registerRefetch={() => () => {}}
          updateCharge={() => {}}
          removeCharge={() => {}}
        />
      ))}
    </ul>
  );
}

function Section({
  title,
  note,
  rows,
  density,
}: {
  title: string;
  note?: string;
  rows: ChargeRow[];
  density?: ChargeDensity;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <p className="text-xs text-gray-600 dark:text-gray-400">{note}</p>}
      </div>
      <RecordList rows={rows} density={density} />
    </section>
  );
}

function AllTypes(): ReactElement {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Charge record — all 11 types</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Every fixture below has <strong>every field populated</strong>. Anything a record does not
          show, it omits because the spec matrix says so — not because the data was missing. Region
          positions are identical on every row; the fields inside them are not.
        </p>
      </div>

      <Section
        title="One record per charge type"
        note="Compare against the Spec Matrix story. The count after each type name there should match the fields you can see here."
        rows={SHEET_ORDER.map(type => makeRow(type))}
      />

      <Section
        title="Missing info, with and without suggestions"
        note="The amber badge in the manage column counts only what this type displays — the same missing-info list yields a different count per type."
        rows={[
          makeRow('CommonCharge', {
            id: 'missing-with-suggestions',
            description: undefined,
            tags: [],
            suggestedDescription: 'Google Cloud EMEA',
            suggestedTags: [{ id: 't1', name: 'saas' }],
            missingInfo: [MissingChargeInfo.Description, MissingChargeInfo.Tags],
          }),
          makeRow('CommonCharge', {
            id: 'missing-no-suggestions',
            description: undefined,
            tags: [],
            counterparty: undefined,
            taxCategory: undefined,
            missingInfo: [
              MissingChargeInfo.Description,
              MissingChargeInfo.Tags,
              MissingChargeInfo.Counterparty,
              MissingChargeInfo.TaxCategory,
            ],
          }),
          makeRow('SalaryCharge', {
            id: 'missing-all-hidden',
            missingInfo: [MissingChargeInfo.Counterparty, MissingChargeInfo.Vat],
          }),
        ]}
      />

      <Section
        title="Health states"
        note="Ledger pending (deferred, still unknown) / differs / invalid, and missing transactions and documents."
        rows={[
          makeRow('CommonCharge', {
            id: 'ledger-pending',
            counts: { transactions: 2, documents: 1, ledger: 0, miscExpenses: 0 },
          }),
          makeRow('CommonCharge', {
            id: 'ledger-diff',
            counts: {
              transactions: 2,
              documents: 1,
              ledger: 4,
              miscExpenses: 0,
              invalidLedger: LedgerValidationStatus.Diff,
            },
          }),
          makeRow('CommonCharge', {
            id: 'ledger-invalid',
            counts: {
              transactions: 0,
              documents: 0,
              ledger: 4,
              miscExpenses: 0,
              invalidLedger: LedgerValidationStatus.Invalid,
            },
            missingInfo: [MissingChargeInfo.Transactions, MissingChargeInfo.Documents],
          }),
        ]}
      />

      <Section
        title="Special cases and edge values"
        note="Credit-card amount validity, the conversion base/quote marker, income vs expense, and a charge with no amount at all."
        rows={[
          makeRow('CreditcardBankCharge', {
            id: 'card-invalid-amount',
            amount: { value: -4320, currency: Currency.Ils, shouldValidate: true, isValid: false },
          }),
          makeRow('CreditcardBankCharge', {
            id: 'card-pending-amount',
            amount: { value: -4320, currency: Currency.Ils, shouldValidate: true },
          }),
          makeRow('ConversionCharge', { id: 'conversion' }),
          makeRow('InternalTransferCharge', { id: 'internal-transfer' }),
          makeRow('CommonCharge', {
            id: 'income',
            amount: { value: 12_500, currency: Currency.Usd, shouldValidate: false },
            description: 'Consulting retainer',
          }),
          makeRow('FinancialCharge', { id: 'no-amount', amount: undefined }),
        ]}
      />

      <Section
        title="Compact density"
        note="Same charges as the first section. Keeps type, date, description, amount and the needs badge; drops date range, counterparty → tax category, tags and the count chips."
        density="compact"
        rows={SHEET_ORDER.map(type => makeRow(type, { id: `compact-${type}` }))}
      />

      <Section
        title="Accountant status"
        note="The status control sits in the manage column so approval state reads straight down the list."
        rows={Object.values(AccountantStatus).map(status =>
          makeRow('CommonCharge', { id: `status-${status}`, accountantApproval: status }),
        )}
      />

      <div className="flex flex-col gap-1 text-sm">
        <h3 className="font-semibold">Field counts per type, from the matrix</h3>
        <ul className="grid grid-cols-2 gap-x-6 text-xs text-gray-700 md:grid-cols-3 dark:text-gray-300">
          {SHEET_ORDER.map(type => (
            <li key={type} className="flex justify-between gap-2 tabular-nums">
              <span>{CHARGE_TYPE_NAME[type]}</span>
              <span className="text-gray-500 dark:text-gray-400">{visibleFields(type).length}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const meta = {
  title: 'Charges/Charge Record',
  component: AllTypes,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof AllTypes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
