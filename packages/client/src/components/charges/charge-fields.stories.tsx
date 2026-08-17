import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CHARGE_TYPE_NAME, getChargeTypeIcon, type ChargeType } from '../../helpers/index.js';
import {
  CHARGE_FIELD_LABEL,
  CHARGE_FIELDS,
  isFieldVisible,
  isSpecialField,
  visibleFields,
} from './charge-fields.js';

/** Row order copied from the spec spreadsheet, so the two can be scanned side by side. */
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
 * A read-back of the spec matrix, laid out the same way as the source spreadsheet so the two can be
 * compared cell by cell. This is genuinely tabular reference data with a uniform attribute set, so
 * unlike the charge record itself, a table is the right shape for it.
 */
function SpecMatrix(): ReactElement {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Charge field spec — as transcribed</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Compare against the source sheet. <strong>✓</strong> shown · <strong>·</strong> hidden ·{' '}
          <strong className="text-amber-700 dark:text-amber-400">★</strong> shown, special-cased.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left align-bottom dark:bg-gray-950">
                type
              </th>
              {CHARGE_FIELDS.map(field => (
                <th
                  key={field}
                  className="border-l border-gray-200 px-2 py-1 align-bottom font-medium dark:border-gray-800"
                >
                  {/* Plain horizontal headings, narrow enough to wrap onto two lines. The table
                      scrolls inside its own container when 14 of them exceed the viewport. */}
                  <span className="block w-16 text-left text-xs leading-tight">
                    {CHARGE_FIELD_LABEL[field]}
                  </span>
                </th>
              ))}
              <th className="border-l border-gray-200 px-2 py-1 text-right align-bottom dark:border-gray-800">
                shown
              </th>
            </tr>
          </thead>
          <tbody>
            {SHEET_ORDER.map(type => (
              <tr key={type} className="border-t border-gray-200 dark:border-gray-800">
                <th className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 text-left font-medium dark:bg-gray-950">
                  <span className="inline-flex items-center gap-2">
                    <span className="[&_svg]:size-4">{getChargeTypeIcon(type)}</span>
                    {CHARGE_TYPE_NAME[type]}
                  </span>
                </th>
                {CHARGE_FIELDS.map(field => {
                  const special = isSpecialField(type, field);
                  const shown = isFieldVisible(type, field);
                  return (
                    <td
                      key={field}
                      className={`border-l border-gray-200 px-1 py-1 text-center tabular-nums dark:border-gray-800 ${
                        special
                          ? 'font-bold text-amber-700 dark:text-amber-400'
                          : shown
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-300 dark:text-gray-700'
                      }`}
                      title={`${CHARGE_TYPE_NAME[type]} · ${CHARGE_FIELD_LABEL[field]}`}
                    >
                      {special ? '★' : shown ? '✓' : '·'}
                    </td>
                  );
                })}
                <td className="border-l border-gray-200 px-2 py-1 text-right tabular-nums text-gray-600 dark:border-gray-800 dark:text-gray-400">
                  {visibleFields(type).length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <h3 className="font-semibold">Special cases</h3>
        <ul className="list-inside list-disc text-gray-700 dark:text-gray-300">
          <li>
            <strong>Conversion · amount</strong> — show the base and quote amounts, not one total.
          </li>
          <li>
            <strong>Internal transfer · main counterparty</strong> — show both sides of the
            transfer.
          </li>
          <li>
            <strong>Charge management</strong> — selection, accountant-approval status and button,
            expansion button, charge menu. Universal across all 11 types, so not a column here.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <h3 className="font-semibold">Why the record composes fields per type</h3>
        <p className="text-gray-700 dark:text-gray-300">
          <strong>VAT</strong> and <strong>business trip</strong> each apply to exactly one of
          eleven types — as table columns they were blank on ten rows out of eleven. Counterparty
          applies to four, tax category to five.
        </p>
      </div>
    </div>
  );
}

const meta = {
  title: 'Charges/Spec Matrix',
  component: SpecMatrix,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SpecMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
